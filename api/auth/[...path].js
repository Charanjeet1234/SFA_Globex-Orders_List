import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import { getAdminEmail, isAdminEmail, requiresAdminEmail } from '../../lib/admin-access.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
  const capturedPath = request.query?.path;
  if (Array.isArray(capturedPath)) return capturedPath.join('/');
  if (typeof capturedPath === 'string' && capturedPath) return capturedPath;

  const pathname = new URL(request.url || '/', `https://${request.headers.host || 'localhost'}`).pathname;
  return pathname.replace(/^\/api\/auth\/?/, '');
}

function toFetchRequest(request, path, body) {
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers.host || 'localhost';
  const url = new URL(request.url || '/', `${protocol}://${host}`);
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

async function readRequestBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body);

  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function validateEmailRequest(request, path, response) {
  if (!requiresAdminEmail(path)) return undefined;

  if (!getAdminEmail()) {
    response.status(503).json({ error: 'Portal administrator access is not configured.' });
    return null;
  }

  const body = await readRequestBody(request);
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

async function writeResponse(response, upstream) {
  response.status(upstream.status);
  for (const [name, value] of upstream.headers) {
    if (name.toLowerCase() !== 'set-cookie') response.setHeader(name, value);
  }
  const cookies = upstream.headers.getSetCookie?.() || [];
  if (cookies.length) response.setHeader('Set-Cookie', cookies);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

export default async function handler(request, response) {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    response.status(503).json({ error: 'Authentication is not configured for this deployment.' });
    return;
  }

  const path = authPathFrom(request);
  const body = await validateEmailRequest(request, path, response);
  if (body === null) return;

  const upstream = await handleAuthProxyRequest({
    request: toFetchRequest(request, path, body),
    path,
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 60,
    sameSite: 'lax',
  });
  await writeResponse(response, upstream);
}
