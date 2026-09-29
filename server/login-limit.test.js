import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginLimit } from './login-limit.js';

function response(onJson) {
  return {
    headers: {},
    statusCode: 200,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; onJson(this); return this; },
  };
}

function request(limit, ip) {
  return new Promise(resolve => {
    const res = response(res => resolve({ res, passed: false }));
    limit({ ip }, res, error => resolve({ res, error, passed: !error }));
  });
}

test('dos instancias comparten el cupo de ambos accesos y devuelven Retry-After', async () => {
  const attempts = new Map();
  const query = async (_sql, [ipHash, max]) => {
    assert.match(ipHash, /^[a-f0-9]{64}$/);
    const count = Math.min((attempts.get(ipHash) || 0) + 1, max + 1);
    attempts.set(ipHash, count);
    return { rows: [{ allowed: count <= max, retry_after_seconds: 60 }] };
  };
  const firstInstance = createLoginLimit(query);
  const secondInstance = createLoginLimit(query);
  const results = await Promise.all(Array.from({ length: 14 }, (_, index) =>
    request(index % 2 ? firstInstance : secondInstance, '203.0.113.8')));
  assert.equal(results.filter(result => result.passed).length, 12);
  assert.equal(results.filter(result => result.res.statusCode === 429).length, 2);
  assert.equal(results[12].res.headers['Retry-After'], '60');
  assert.equal((await request(firstInstance, '203.0.113.9')).passed, true);
});

test('un fallo de PostgreSQL impide comprobar credenciales', async () => {
  const failure = new Error('PostgreSQL no disponible');
  const limit = createLoginLimit(async () => { throw failure; });
  const result = await request(limit, '203.0.113.8');
  assert.equal(result.error, failure);
  assert.equal(result.passed, false);
});
