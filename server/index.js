import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { query, pool } from './db.js';
import auth, { session } from './auth.js';
import catalog from './catalog.js';
import admin from './admin.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' });
  next();
});
app.use('/assets', express.static(resolve(root, 'assets'), { maxAge: '1d', immutable: false }));
for (const file of ['plataforma.html','plataforma.css','plataforma.js','ui-fixes.css','admin-tools.css','admin-tools.js','server-ui.css','index.html','styles.css','app.js']) {
  app.get(`/${file}`, (_req, res) => res.sendFile(resolve(root, file)));
}
app.get('/', (_req, res) => res.redirect('/plataforma.html'));
app.get('/api/health', async (_req, res) => {
  try { await query('select 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'database_unavailable' }); }
});
app.use('/api', express.json({ limit: '64kb' }));
app.use('/api', (req, res, next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Origen no permitido' });
  next();
});
app.use('/api/v1', session);
app.use('/api/v1/auth', auth);
app.use('/api/v1', catalog);
app.use('/api/v1/admin', admin);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Error interno' });
});

const port = Number(process.env.PORT || 4173);
const server = app.listen(port, '0.0.0.0', () => console.log(`Kitsune escuchando en ${port}`));
process.on('SIGTERM', () => server.close(() => pool.end()));
