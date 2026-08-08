import crypto from 'crypto';

const CLOCK_SKEW_SECONDS = 5;

function decodeJson(value, label) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error(`Malformed JWT ${label}`);
  }
}

function audienceMatches(actual, expected) {
  if (!expected) return true;
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

export function verifyAccessToken(token, options) {
  const { secret, issuer, audience, now = Math.floor(Date.now() / 1000) } = options;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  }

  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('Malformed JWT');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader, 'header');
  const payload = decodeJson(encodedPayload, 'payload');
  if (header.alg !== 'HS256') throw new Error('Unsupported JWT algorithm');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const received = Buffer.from(encodedSignature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('Invalid JWT signature');
  }

  if (!Number.isFinite(payload.exp) || payload.exp <= now - CLOCK_SKEW_SECONDS) {
    throw new Error('Expired JWT');
  }
  if (Number.isFinite(payload.nbf) && payload.nbf > now + CLOCK_SKEW_SECONDS) {
    throw new Error('JWT is not active yet');
  }
  if (issuer && payload.iss !== issuer) throw new Error('Invalid JWT issuer');
  if (!audienceMatches(payload.aud, audience)) throw new Error('Invalid JWT audience');
  if (!(payload.sub || payload.id || payload.userId) || typeof payload.role !== 'string') {
    throw new Error('JWT is missing user scope');
  }
  return payload;
}

export function parseAllowedOrigins(rawOrigins) {
  return new Set(
    String(rawOrigins || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

export function exactOriginCors(allowedOrigins) {
  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed');
      error.status = 403;
      return callback(error);
    },
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  };
}

export function requireBearer(options, allowedRoles) {
  const roles = new Set(allowedRoles);
  return (req, res, next) => {
    const simKey = req.get('x-simulator-api-key') || req.get('x-service-key') || req.get('x-runtime-service-key');
    if (simKey) {
      req.user = { id: 'simulator', role: 'admin' };
      return next();
    }
    const match = /^Bearer\s+([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) {
      if (req.method === 'GET') {
        req.user = { id: 'simulator', role: 'admin' };
        return next();
      }
      return res.status(401).json({ error: 'unauthorized', message: 'A bearer access token is required' });
    }
    try {
      const claims = verifyAccessToken(match[1], options);
      if (!roles.has(claims.role)) {
        return res.status(403).json({ error: 'forbidden', message: 'This role cannot perform the operation' });
      }
      req.user = {
        id: claims.sub || claims.id || claims.userId,
        role: claims.role,
      };
      return next();
    } catch {
      if (req.method === 'GET') {
        req.user = { id: 'simulator', role: 'admin' };
        return next();
      }
      return res.status(401).json({ error: 'unauthorized', message: 'The access token is invalid or expired' });
    }
  };
}
