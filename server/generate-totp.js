import { randomBytes } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let bits = 0, buffer = 0, secret = '';
for (const byte of randomBytes(20)) {
  buffer = (buffer << 8) | byte;
  bits += 8;
  while (bits >= 5) {
    bits -= 5;
    secret += alphabet[(buffer >>> bits) & 31];
  }
}
const email = process.env.ADMIN_EMAIL || 'admin@kitsune.local';
const label = encodeURIComponent(`Kitsune:${email}`);
console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log(`URI para la aplicación autenticadora: otpauth://totp/${label}?secret=${secret}&issuer=Kitsune&algorithm=SHA1&digits=6&period=30`);
console.log('Guarda la clave en Render como variable privada; no la incluyas en Git ni en capturas compartidas.');
