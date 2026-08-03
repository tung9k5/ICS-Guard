import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { SCENARIO_ALLOWLIST } from '../src/catalog.js';
import {
  exactOriginCors,
  parseAllowedOrigins,
  verifyAccessToken,
} from '../src/security.js';

const secret = 'test-only-secret-with-at-least-32-characters';

function token(payload, algorithm = 'HS256') {
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

test('catalog uses only canonical underscore scenario ids and excludes stop', () => {
  assert.equal(SCENARIO_ALLOWLIST.length, 10);
  assert.ok(SCENARIO_ALLOWLIST.every(({ id }) => /^[a-z]+(?:_[a-z]+)*$/.test(id)));
  assert.equal(SCENARIO_ALLOWLIST.some(({ id }) => id === 'stop'), false);
});

test('verifies a scoped, unexpired HS256 user token', () => {
  const claims = verifyAccessToken(token({ id: 'user-1', role: 'analyst', exp: 2000 }), {
    secret,
    now: 1000,
  });
  assert.equal(claims.role, 'analyst');
});

test('rejects algorithm confusion, missing user scope, and expired tokens', () => {
  assert.throws(
    () => verifyAccessToken(token({ id: 'u', role: 'admin', exp: 2000 }, 'none'), { secret, now: 1000 }),
    /algorithm/
  );
  assert.throws(
    () => verifyAccessToken(token({ role: 'admin', exp: 2000 }), { secret, now: 1000 }),
    /scope/
  );
  assert.throws(
    () => verifyAccessToken(token({ id: 'u', role: 'admin', exp: 999 }), { secret, now: 1005 }),
    /Expired/
  );
});

test('CORS accepts exact configured origins only', async () => {
  const cors = exactOriginCors(parseAllowedOrigins('https://attacker.local,http://localhost:5174'));
  await new Promise((resolve, reject) => cors.origin('https://attacker.local', (error, allowed) => {
    if (error) return reject(error);
    assert.equal(allowed, true);
    resolve();
  }));
  await new Promise((resolve) => cors.origin('https://attacker.local.evil.example', (error) => {
    assert.equal(error?.status, 403);
    resolve();
  }));
});
