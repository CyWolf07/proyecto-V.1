import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTotpSecret, matchingTotpStep, totpForStep } from '../server/totp.js';

test('TOTP coincide con el vector RFC 6238 de SHA-1 a seis dígitos', () => {
  const key = decodeTotpSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(totpForStep(key, 1), '287082');
  assert.equal(matchingTotpStep(key, '287082', 59_000), 1);
});

test('TOTP rechaza claves y códigos mal formados', () => {
  assert.throws(() => decodeTotpSecret('1234'));
  const key = decodeTotpSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(matchingTotpStep(key, 287082, 59_000), null);
  assert.equal(matchingTotpStep(key, '287082', 180_000), null);
});
