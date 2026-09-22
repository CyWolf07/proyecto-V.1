import { Router } from 'express';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';

const scrypt = promisify(scryptCallback);
const router = Router();
const cookieName = 'kitsune_session';
const lifetimeMs = 7 * 24 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = await scrypt(password, salt, 64);
  const old = Buffer.from(expected, 'hex');
  return old.length === actual.length && timingSafeEqual(old, actual);
}
function equalSecret(a, b) {
  const x = Buffer.from(digest(a));
  const y = Buffer.from(digest(b));
  return timingSafeEqual(x, y);
}
function sessionCookie(res, token, maxAge = lifetimeMs) {
  res.cookie(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge });
}
async function createSession(res, userId, role) {
  const token = randomBytes(32).toString('base64url');
  await query('insert into kitsune.sessions(token_hash,user_id,role,expires_at) values ($1,$2,$3,$4)', [digest(token), userId, role, new Date(Date.now() + lifetimeMs)]);
  sessionCookie(res, token);
}
export async function session(req, _res, next) {
  try {
    const raw = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (raw) {
      const { rows } = await query(`select s.id,coalesce(u.role,s.role) as role,u.id as user_id,u.email,u.display_name,u.is_active
        from kitsune.sessions s left join kitsune.users u on u.id=s.user_id
        where s.token_hash=$1 and s.expires_at>now()`, [digest(raw)]);
      req.session = rows[0] && (rows[0].user_id === null || rows[0].is_active) ? rows[0] : null;
    }
    next();
  } catch (error) { next(error); }
}
export function requireRole(role) {
  return (req, res, next) => req.session?.role === role ? next() : res.status(403).json({ error: 'Acceso denegado' });
}
router.post('/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  const password = String(req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || password.length < 10) return res.status(400).json({ error: 'Nombre, correo o contraseña inválidos (mínimo 10 caracteres)' });
  const hash = await hashPassword(password);
  try {
    const { rows } = await query('insert into kitsune.users(email,display_name,password_hash) values ($1,$2,$3) returning id,email,display_name,role', [email, name, hash]);
    await createSession(res, rows[0].id, 'user');
    res.status(201).json({ user: rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ese correo ya está registrado' });
    throw error;
  }
});
router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const { rows } = await query('select id,email,display_name,role,password_hash,is_active from kitsune.users where email=$1', [email]);
  if (!rows[0] || !rows[0].is_active || !(await verifyPassword(password, rows[0].password_hash))) return res.status(401).json({ error: 'Credenciales incorrectas' });
  await createSession(res, rows[0].id, rows[0].role);
  const { password_hash: _, is_active: __, ...user } = rows[0];
  res.json({ user });
});
router.post('/admin/login', async (req, res) => {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Acceso administrativo no configurado' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!equalSecret(email, process.env.ADMIN_EMAIL.toLowerCase()) || !equalSecret(password, process.env.ADMIN_PASSWORD)) return res.status(401).json({ error: 'Credenciales incorrectas' });
  await createSession(res, null, 'admin');
  res.json({ role: 'admin' });
});
router.get('/me', (req, res) => res.json({ user: req.session ? { id: req.session.user_id, email: req.session.email, name: req.session.display_name || 'Administrador', role: req.session.role } : null }));
router.post('/logout', async (req, res) => {
  if (req.session) await query('delete from kitsune.sessions where id=$1', [req.session.id]);
  sessionCookie(res, '', 0);
  res.json({ ok: true });
});
export default router;
