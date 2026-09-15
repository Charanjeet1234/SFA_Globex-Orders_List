import { productionStore } from '../lib/postgres-store.js';
import { handleAuthProxyRequest } from '@neondatabase/auth/server';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  if (typeof request.body === 'string') {
    return JSON.parse(request.body || '{}');
  }

  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}

function apiPathFrom(request) {
  const capturedPath = request.query?.path;
  if (Array.isArray(capturedPath)) return capturedPath.join('/');
  if (typeof capturedPath === 'string' && capturedPath) return capturedPath;

  const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
  return url.pathname.replace(/^\/api\/?/, '');
}

function send(response, status, value) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(status).json(value);
}

function appendCookies(response, upstream) {
  const cookies = upstream.headers.getSetCookie?.() || [];
  if (cookies.length) response.setHeader('Set-Cookie', cookies);
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

function toFetchRequest(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers.host || 'localhost';
  const init = {
    method: request.method,
    headers: requestHeaders(request.headers),
  };

  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    init.body = request;
    init.duplex = 'half';
  }

  return new Request(new URL(request.url || '/', `${protocol}://${host}`), init);
}

async function proxyAuthenticationRequest(request, response, path) {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    send(response, 503, { error: 'Authentication is not configured for this deployment.' });
    return;
  }

  const upstream = await handleAuthProxyRequest({
    request: toFetchRequest(request),
    path,
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 60,
    sameSite: 'lax',
  });

  response.status(upstream.status);
  for (const [name, value] of upstream.headers) {
    if (name.toLowerCase() !== 'set-cookie') response.setHeader(name, value);
  }
  appendCookies(response, upstream);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function requireAuthenticatedUser(request, response) {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    send(response, 503, { error: 'Authentication is not configured for this deployment.' });
    return null;
  }

  const protocol = request.headers['x-forwarded-proto'] || 'https';
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
  appendCookies(response, sessionResponse);

  if (!sessionResponse.ok) {
    send(response, 401, { error: 'Authentication is required to access the order database.' });
    return null;
  }

  const session = await sessionResponse.json();
  const user = session?.user || session?.data?.user || null;
  if (!user) {
    send(response, 401, { error: 'Authentication is required to access the order database.' });
    return null;
  }
  return user;
}

export default async function handler(request, response) {
  const path = apiPathFrom(request).split('/').filter(Boolean);
  const [resource, id, action] = path;

  try {
    if (resource === 'auth') {
      await proxyAuthenticationRequest(request, response, path.slice(1).join('/'));
      return;
    }

    if (!process.env.DATABASE_URL) {
      send(response, 503, {
        error: 'The production database is not configured. Add DATABASE_URL in Vercel before using this deployment.',
      });
      return;
    }

    const user = await requireAuthenticatedUser(request, response);
    if (!user) {
      return;
    }

    if (request.method === 'GET' && resource === 'state' && !id) {
      send(response, 200, await productionStore.getState());
      return;
    }

    if (request.method === 'POST' && resource === 'state' && id === 'initialize') {
      send(response, 201, await productionStore.initialize(await readBody(request)));
      return;
    }

    if (request.method === 'PUT' && resource === 'state' && !id) {
      send(response, 200, await productionStore.replaceState(await readBody(request)));
      return;
    }

    if (request.method === 'POST' && resource === 'orders' && !id) {
      send(response, 201, await productionStore.createOrder(await readBody(request)));
      return;
    }

    if (request.method === 'PUT' && resource === 'orders' && id) {
      const order = await readBody(request);
      if (decodeURIComponent(id) !== order?.id) {
        send(response, 400, { error: 'The order URL and request body do not match.' });
        return;
      }
      send(response, 200, await productionStore.updateOrder(order));
      return;
    }

    if (request.method === 'DELETE' && resource === 'orders' && id) {
      send(response, 200, await productionStore.deleteOrder(decodeURIComponent(id)));
      return;
    }

    if (request.method === 'POST' && resource === 'companies' && !id) {
      send(response, 201, await productionStore.createCompany(await readBody(request)));
      return;
    }

    if (request.method === 'DELETE' && resource === 'companies' && id) {
      send(response, 200, await productionStore.deleteCompany(decodeURIComponent(id)));
      return;
    }

    if (request.method === 'POST' && resource === 'audit-logs' && !id) {
      send(response, 201, await productionStore.createAuditLog(await readBody(request)));
      return;
    }

    if (action) {
      send(response, 404, { error: 'API route not found.' });
      return;
    }
    send(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Production API error:', error);
    send(response, 400, {
      error: error instanceof Error ? error.message : 'Database request failed.',
    });
  }
}
