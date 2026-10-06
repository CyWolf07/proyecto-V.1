import { createHmac, timingSafeEqual } from 'node:crypto';

export function decodeTotpSecret(value) {
  const secret = String(value || '').replace(/\s|-/g, '').toUpperCase();
  if (!/^[A-Z2-7]{26,}$/.test(secret)) throw new Error('ADMIN_TOTP_SECRET debe ser una clave Base32 de al menos 26 caracteres');
  let bits = 0, buffer = 0;
  const bytes = [];
  for (const char of secret) {
    buffer = (buffer << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); }
  }
  if (bytes.length < 16) throw new Error('ADMIN_TOTP_SECRET debe contener al menos 128 bits');
  return Buffer.from(bytes);
}

export function totpForStep(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export function matchingTotpStep(secret, code, now = Date.now()) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30_000);
  const supplied = Buffer.from(code);
  for (const candidate of [step, step - 1, step + 1]) {
    if (candidate >= 0 && timingSafeEqual(Buffer.from(totpForStep(secret, candidate)), supplied)) return candidate;
  }
  return null;
}
