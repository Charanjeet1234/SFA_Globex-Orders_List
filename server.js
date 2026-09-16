import { normalizeOrderPayments } from './lib/order-payments.js';
import express from 'express';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';
import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import dotenv from 'dotenv';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdminEmail, isAdminEmail, isAdminUser, requiresAdminEmail } from './lib/admin-access.js';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(projectDirectory, '.env.local'), quiet: true });
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

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return now();

  const input = value.trim();
  const gstMatch = input.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*GST$/i);
  if (gstMatch) return `${gstMatch[1]}T${gstMatch[2]}+04:00`;

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? now() : parsed.toISOString();
}

function orderIdFromPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw).trim();
  } catch {
    throw new Error('The order URL contains an invalid order ID.');
  }
}

function requestHeaders(headers) {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) result.append(name, entry);
    } else if (value) {
      result.set(name, value);
    }
  }
  return result;
}

function authPathFrom(request) {
  const url = new URL(request.originalUrl || request.url || '/', `http://${request.headers.host || 'localhost'}`);
  return url.pathname.replace(/^\/api\/auth\/?/, '');
}

function toAuthFetchRequest(request, path, body) {
  const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
  const host = request.headers.host || 'localhost';
  const url = new URL(request.originalUrl || request.url || '/', `${protocol}://${host}`);
  url.pathname = `/api/auth/${path}`;

  const init = {
    method: request.method,
    headers: requestHeaders(request.headers),
  };

  if (body !== undefined) {
    init.body = body;
    init.duplex = 'half';
  } else if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    init.body = request;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function readAuthRequestBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body);

  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function validateAdminEmailRequest(request, path, response) {
  if (!requiresAdminEmail(path)) return undefined;

  if (!getAdminEmail()) {
    response.status(503).json({ error: 'Portal administrator access is not configured.' });
    return null;
  }

  const body = await readAuthRequestBody(request);
  let email = '';
  try {
    email = JSON.parse(body.toString('utf8') || '{}').email;
  } catch {
    response.status(400).json({ error: 'A valid email request body is required.' });
    return null;
  }

  if (!isAdminEmail(email)) {
    response.status(403).json({ error: 'This portal is restricted to its designated administrator.' });
    return null;
  }

  return body;
}

function copyAuthResponse(response, upstream) {
  response.status(upstream.status);
  for (const [name, value] of upstream.headers) {
    if (name.toLowerCase() !== 'set-cookie') response.setHeader(name, value);
  }
  const cookies = upstream.headers.getSetCookie?.() || [];
  if (cookies.length) response.setHeader('Set-Cookie', cookies);
}

async function getAuthenticatedUser(request, response) {
  const protocol = request.headers['x-forwarded-proto'] || request.protocol || 'http';
  const host = request.headers.host || 'localhost';
  const sessionRequest = new Request(new URL('/api/auth/get-session', `${protocol}://${host}`), {
    method: 'GET',
    headers: {
      cookie: request.headers.cookie || '',
      origin: `${protocol}://${host}`,
    },
  });
  const sessionResponse = await handleAuthProxyRequest({
    request: sessionRequest,
    path: 'get-session',
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 60,
    sameSite: 'lax',
  });
  const cookies = sessionResponse.headers.getSetCookie?.() || [];
  if (cookies.length) response.setHeader('Set-Cookie', cookies);

  if (!sessionResponse.ok) return null;
  const session = await sessionResponse.json();
  return session?.user || session?.data?.user || null;
}

function getState() {
  return {
    initialized: Boolean(database.prepare("SELECT 1 FROM app_metadata WHERE key = 'initialized'").get()),
    orders: database.prepare('SELECT payload FROM orders ORDER BY updated_at DESC').all().map(readPayload).map(normalizeOrderPayments),
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
  order = normalizeOrderPayments(order);
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
  replaceRows('orders', orders.map(normalizeOrderPayments), {
    sql: 'INSERT INTO orders (id, company_id, order_number, total_amount_usd, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    values: (order) => [order.id, order.companyId, order.orderNumber, Number(order.totalAmountUSD || 0), JSON.stringify(order), order.updatedAt || now()],
  });
  replaceRows('companies', companies, {
    sql: 'INSERT INTO companies (id, name, payload, updated_at) VALUES (?, ?, ?, ?)',
    values: (company) => [company.id, company.name, JSON.stringify(company), now()],
  });
  replaceRows('audit_logs', auditLogs, {
    sql: 'INSERT INTO audit_logs (id, payload, created_at) VALUES (?, ?, ?)',
    values: (log) => {
      const createdAt = normalizeTimestamp(log.timestamp);
      return [log.id, JSON.stringify({ ...log, timestamp: createdAt }), createdAt];
    },
  });
  database.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('initialized', 'true')").run();
  refreshCompanySummaries();
});

const app = express();

app.all('/api/auth/*', async (request, response, next) => {
  try {
    if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
      response.status(503).json({ error: 'Authentication is not configured for local development.' });
      return;
    }

    const path = authPathFrom(request);
    const body = await validateAdminEmailRequest(request, path, response);
    if (body === null) return;
    const upstream = await handleAuthProxyRequest({
      request: toAuthFetchRequest(request, path, body),
      path,
      baseUrl: process.env.NEON_AUTH_BASE_URL,
      cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
      sessionDataTtl: 60,
      sameSite: 'lax',
    });
    copyAuthResponse(response, upstream);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    next(error);
  }
});

// Auth requests must retain their raw request stream for the Neon proxy.
app.use(express.json({ limit: '1mb' }));

app.use('/api', async (request, response, next) => {
  try {
    if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
      response.status(503).json({ error: 'Authentication is not configured for local development.' });
      return;
    }

    if (!getAdminEmail()) {
      response.status(503).json({ error: 'Portal administrator access is not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(request, response);
    if (!user) {
      response.status(401).json({ error: 'Authentication is required to access the local order database.' });
      return;
    }
    if (!isAdminUser(user)) {
      response.status(403).json({ error: 'This portal is restricted to its designated administrator.' });
      return;
    }
    response.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/api/access', (_request, response) => {
  response.json({ authorized: true });
});

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
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
      response.status(400).json({ error: 'A valid order payload is required.' });
      return;
    }
    const orderId = orderIdFromPath(request.params.id);
    if (!orderId) {
      response.status(400).json({ error: 'An order ID is required.' });
      return;
    }
    database.transaction(() => {
      upsertOrder({ ...request.body, id: orderId });
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
    const createdAt = normalizeTimestamp(log.timestamp);
    const persistedLog = { ...log, timestamp: createdAt };
    upsertLogStatement.run(persistedLog.id, JSON.stringify(persistedLog), createdAt);
    response.status(201).json(persistedLog);
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
    server: {
      middlewareMode: true,
      hmr: {
        host: '127.0.0.1',
        port: Number(process.env.SFA_HMR_PORT || 24679),
      },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  console.log(`SFA Globex is running at http://localhost:${port}`);
  console.log(`SQLite database: ${databasePath}`);
});
