import { handleAuthProxyRequest } from '@neondatabase/auth/server';

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

function toFetchRequest(request, path) {
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers.host || 'localhost';
  const url = new URL(request.url || '/', `${protocol}://${host}`);
  url.pathname = `/api/auth/${path}`;
  const init = {
    method: request.method,
    headers: requestHeaders(request.headers),
  };

  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    init.body = request;
    init.duplex = 'half';
  }

  return new Request(url, init);
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
  const upstream = await handleAuthProxyRequest({
    request: toFetchRequest(request, path),
    path,
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 60,
    sameSite: 'lax',
  });
  await writeResponse(response, upstream);
}
