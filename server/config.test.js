import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';

const validProduction = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://kitsune:secret@database.internal:5432/kitsune',
  ADMIN_EMAIL: 'administracion@kitsune.test',
  ADMIN_PASSWORD: 'una-frase-larga-y-unica-2026',
};

test('acepta una configuración completa de producción', () => {
  const config = loadConfig(validProduction);
  assert.equal(config.production, true);
  assert.equal(config.dbPoolMax, 5);
});

test('rechaza valores de ejemplo en DATABASE_URL', () => {
  assert.throws(() => loadConfig({ DATABASE_URL: 'postgresql://USER:PASSWORD@HOST:5432/postgres' }), /valores de ejemplo/);
});

test('producción exige las credenciales administrativas', () => {
  assert.throws(() => loadConfig({ ...validProduction, ADMIN_EMAIL: '' }), /ADMIN_EMAIL es obligatoria/);
  assert.throws(() => loadConfig({ ...validProduction, ADMIN_PASSWORD: 'corta' }), /al menos 16 caracteres/);
});

test('desarrollo permite omitir el acceso administrativo', () => {
  const config = loadConfig({ DATABASE_URL: validProduction.DATABASE_URL });
  assert.equal(config.adminEmail, '');
});
