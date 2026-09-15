import express from 'express';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.SFA_DATABASE_PATH || path.join(projectDirectory, 'data', 'sfa-globex.sqlite');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    total_amount_usd REAL NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const readPayload = (row) => JSON.parse(row.payload);
const now = () => new Date().toISOString();

function getState() {
  return {
    initialized: Boolean(database.prepare("SELECT 1 FROM app_metadata WHERE key = 'initialized'").get()),
    orders: database.prepare('SELECT payload FROM orders ORDER BY updated_at DESC').all().map(readPayload),
    companies: database.prepare('SELECT payload FROM companies ORDER BY name COLLATE NOCASE').all().map(readPayload),
    auditLogs: database.prepare('SELECT payload FROM audit_logs ORDER BY created_at DESC').all().map(readPayload),
  };
}

function replaceRows(table, rows, toRecord) {
  database.prepare(`DELETE FROM ${table}`).run();
  const insert = database.prepare(toRecord.sql);
  for (const row of rows) {
    insert.run(...toRecord.values(row));
  }
}

const upsertOrderStatement = database.prepare(`
  INSERT INTO orders (id, company_id, order_number, total_amount_usd, payload, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    company_id = excluded.company_id,
    order_number = excluded.order_number,
    total_amount_usd = excluded.total_amount_usd,
    payload = excluded.payload,
    updated_at = excluded.updated_at
`);
const upsertCompanyStatement = database.prepare(`
  INSERT INTO companies (id, name, payload, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    payload = excluded.payload,
    updated_at = excluded.updated_at
`);
const upsertLogStatement = database.prepare(`
  INSERT INTO audit_logs (id, payload, created_at)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at
`);

function upsertOrder(order) {
  if (!order?.id || !order.orderNumber || !order.companyId) {
    throw new Error('An order id, order number, and company are required.');
  }
  const updatedAt = order.updatedAt || now();
  upsertOrderStatement.run(
    order.id,
    order.companyId,
    order.orderNumber,
    Number(order.totalAmountUSD || 0),
    JSON.stringify({ ...order, updatedAt }),
    updatedAt,
  );
}

function upsertCompany(company) {
  if (!company?.id || !company.name) {
    throw new Error('A company id and name are required.');
  }
  const updatedAt = now();
  upsertCompanyStatement.run(company.id, company.name, JSON.stringify(company), updatedAt);
}

function refreshCompanySummaries() {
  const orders = database.prepare('SELECT payload FROM orders').all().map(readPayload);
  const companies = database.prepare('SELECT payload FROM companies').all().map(readPayload);

  for (const company of companies) {
    const companyOrders = orders.filter((order) => order.companyId === company.id);
    upsertCompany({
      ...company,
      totalOrdersCount: companyOrders.length,
      totalOrderVolumeUSD: companyOrders.reduce((total, order) => total + Number(order.totalAmountUSD || 0), 0),
    });
  }
}

const replaceState = database.transaction(({ orders = [], companies = [], auditLogs = [] }) => {
  replaceRows('orders', orders, {
    sql: 'INSERT INTO orders (id, company_id, order_number, total_amount_usd, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    values: (order) => [order.id, order.companyId, order.orderNumber, Number(order.totalAmountUSD || 0), JSON.stringify(order), order.updatedAt || now()],
  });
  replaceRows('companies', companies, {
    sql: 'INSERT INTO companies (id, name, payload, updated_at) VALUES (?, ?, ?, ?)',
    values: (company) => [company.id, company.name, JSON.stringify(company), now()],
  });
  replaceRows('audit_logs', auditLogs, {
    sql: 'INSERT INTO audit_logs (id, payload, created_at) VALUES (?, ?, ?)',
    values: (log) => [log.id, JSON.stringify(log), log.timestamp || now()],
  });
  database.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('initialized', 'true')").run();
  refreshCompanySummaries();
});

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/state', (_request, response) => {
  response.json(getState());
});

app.post('/api/state/initialize', (request, response, next) => {
  try {
    if (!getState().initialized) {
      replaceState(request.body);
    }
    response.status(201).json(getState());
  } catch (error) {
    next(error);
  }
});

app.put('/api/state', (request, response, next) => {
  try {
    replaceState(request.body);
    response.json(getState());
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', (request, response, next) => {
  try {
    database.transaction(() => {
      upsertOrder(request.body);
      refreshCompanySummaries();
    })();
    response.status(201).json(getState());
  } catch (error) {
    next(error);
  }
});

app.put('/api/orders/:id', (request, response, next) => {
  try {
    if (request.params.id !== request.body?.id) {
      response.status(400).json({ error: 'The order URL and request body do not match.' });
      return;
    }
    database.transaction(() => {
      upsertOrder(request.body);
      refreshCompanySummaries();
    })();
    response.json(getState());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/orders/:id', (request, response, next) => {
  try {
    database.transaction(() => {
      database.prepare('DELETE FROM orders WHERE id = ?').run(request.params.id);
      refreshCompanySummaries();
    })();
    response.json(getState());
  } catch (error) {
    next(error);
  }
});

app.post('/api/companies', (request, response, next) => {
  try {
    upsertCompany(request.body);
    response.status(201).json(getState());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/companies/:id', (request, response, next) => {
  try {
    database.prepare('DELETE FROM companies WHERE id = ?').run(request.params.id);
    response.json(getState());
  } catch (error) {
    next(error);
  }
});

app.post('/api/audit-logs', (request, response, next) => {
  try {
    const log = request.body;
    if (!log?.id) throw new Error('An audit log id is required.');
    upsertLogStatement.run(log.id, JSON.stringify(log), log.timestamp || now());
    response.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(400).json({ error: error instanceof Error ? error.message : 'Database request failed.' });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(projectDirectory, 'dist')));
  app.get('*', (_request, response) => response.sendFile(path.join(projectDirectory, 'dist', 'index.html')));
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  console.log(`SFA Globex is running at http://localhost:${port}`);
  console.log(`SQLite database: ${databasePath}`);
});
