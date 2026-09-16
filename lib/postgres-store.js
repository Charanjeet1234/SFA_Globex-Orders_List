import { normalizeOrderPayments } from './order-payments.js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

let pool;
let schemaPromise;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Connect a Postgres database before deploying.');
  }

  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return pool;
}

function payloadFrom(row) {
  return typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
}

function timestamp() {
  return new Date().toISOString();
}

// Browsers used by the previous version stored audit entries as
// "YYYY-MM-DD HH:mm:ss GST". PostgreSQL accepts ISO 8601 timestamps but not
// that display-only suffix, so convert legacy records before persisting them.
function normalizeTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return timestamp();

  const input = value.trim();
  const gstMatch = input.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*GST$/i);
  if (gstMatch) {
    return `${gstMatch[1]}T${gstMatch[2]}+04:00`;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? timestamp() : parsed.toISOString();
}

function assertCollection(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = getPool().query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        order_number TEXT NOT NULL UNIQUE,
        total_amount_usd NUMERIC NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

async function getStateFrom(client) {
  const initialized = await client.query("SELECT 1 FROM app_metadata WHERE key = 'initialized'");
  const orders = await client.query('SELECT payload FROM orders ORDER BY updated_at DESC');
  const companies = await client.query('SELECT payload FROM companies ORDER BY name COLLATE "C"');
  const auditLogs = await client.query('SELECT payload FROM audit_logs ORDER BY created_at DESC');

  return {
    initialized: initialized.rowCount > 0,
    orders: orders.rows.map(payloadFrom).map(normalizeOrderPayments),
    companies: companies.rows.map(payloadFrom),
    auditLogs: auditLogs.rows.map(payloadFrom),
  };
}

async function replaceTables(client, { orders = [], companies = [], auditLogs = [] }) {
  assertCollection(orders, 'orders');
  assertCollection(companies, 'companies');
  assertCollection(auditLogs, 'auditLogs');

  await client.query('DELETE FROM audit_logs');
  await client.query('DELETE FROM orders');
  await client.query('DELETE FROM companies');

  for (const order of orders) {
    await upsertOrder(client, order);
  }
  for (const company of companies) {
    await upsertCompany(client, company);
  }
  for (const log of auditLogs) {
    await upsertAuditLog(client, log);
  }
}

async function upsertOrder(client, order) {
  if (!order?.id || !order.orderNumber || !order.companyId) {
    throw new Error('An order id, order number, and company are required.');
  }
  const updatedAt = order.updatedAt || timestamp();
  const persistedOrder = normalizeOrderPayments({ ...order, updatedAt });
  await client.query(`
    INSERT INTO orders (id, company_id, order_number, total_amount_usd, payload, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      order_number = EXCLUDED.order_number,
      total_amount_usd = EXCLUDED.total_amount_usd,
      payload = EXCLUDED.payload,
      updated_at = EXCLUDED.updated_at
  `, [
    persistedOrder.id,
    persistedOrder.companyId,
    persistedOrder.orderNumber,
    Number(persistedOrder.totalAmountUSD || 0),
    JSON.stringify(persistedOrder),
    updatedAt,
  ]);
}

async function upsertCompany(client, company) {
  if (!company?.id || !company.name) {
    throw new Error('A company id and name are required.');
  }
  await client.query(`
    INSERT INTO companies (id, name, payload, updated_at)
    VALUES ($1, $2, $3::jsonb, $4)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      payload = EXCLUDED.payload,
      updated_at = EXCLUDED.updated_at
  `, [company.id, company.name, JSON.stringify(company), timestamp()]);
}

async function upsertAuditLog(client, log) {
  if (!log?.id) {
    throw new Error('An audit log id is required.');
  }
  const createdAt = normalizeTimestamp(log.timestamp);
  const persistedLog = { ...log, timestamp: createdAt };
  await client.query(`
    INSERT INTO audit_logs (id, payload, created_at)
    VALUES ($1, $2::jsonb, $3)
    ON CONFLICT (id) DO UPDATE SET
      payload = EXCLUDED.payload,
      created_at = EXCLUDED.created_at
  `, [persistedLog.id, JSON.stringify(persistedLog), createdAt]);
}

async function refreshCompanySummaries(client) {
  const orderResult = await client.query('SELECT payload FROM orders');
  const companyResult = await client.query('SELECT payload FROM companies');
  const orders = orderResult.rows.map(payloadFrom);

  for (const row of companyResult.rows) {
    const company = payloadFrom(row);
    const companyOrders = orders.filter((order) => order.companyId === company.id);
    await upsertCompany(client, {
      ...company,
      totalOrdersCount: companyOrders.length,
      totalOrderVolumeUSD: companyOrders.reduce(
        (total, order) => total + Number(order.totalAmountUSD || 0),
        0,
      ),
    });
  }
}

async function transaction(operation) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const productionStore = {
  async getState() {
    await ensureSchema();
    return getStateFrom(getPool());
  },

  async initialize(state) {
    return transaction(async (client) => {
      const initialized = await client.query(`
        INSERT INTO app_metadata (key, value)
        VALUES ('initialized', 'true')
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `);
      if (initialized.rowCount > 0) {
        await replaceTables(client, state);
        await refreshCompanySummaries(client);
      }
      return getStateFrom(client);
    });
  },

  async replaceState(state) {
    return transaction(async (client) => {
      await replaceTables(client, state);
      await client.query(`
        INSERT INTO app_metadata (key, value)
        VALUES ('initialized', 'true')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);
      await refreshCompanySummaries(client);
      return getStateFrom(client);
    });
  },

  async createOrder(order) {
    return transaction(async (client) => {
      await upsertOrder(client, order);
      await refreshCompanySummaries(client);
      return getStateFrom(client);
    });
  },

  async updateOrder(order) {
    return this.createOrder(order);
  },

  async deleteOrder(orderId) {
    return transaction(async (client) => {
      await client.query('DELETE FROM orders WHERE id = $1', [orderId]);
      await refreshCompanySummaries(client);
      return getStateFrom(client);
    });
  },

  async createCompany(company) {
    return transaction(async (client) => {
      await upsertCompany(client, company);
      return getStateFrom(client);
    });
  },

  async deleteCompany(companyId) {
    return transaction(async (client) => {
      await client.query('DELETE FROM companies WHERE id = $1', [companyId]);
      return getStateFrom(client);
    });
  },

  async createAuditLog(log) {
    return transaction(async (client) => {
      await upsertAuditLog(client, log);
      return log;
    });
  },
};
