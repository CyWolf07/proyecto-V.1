import { Router } from 'express';
import { query, pool } from './db.js';
import { requireRole } from './auth.js';

const router = Router();
router.use(requireRole('admin'));
const validId = value => /^[0-9a-f-]{36}$/i.test(value || '');
const short = (value, max = 160) => String(value || '').trim().slice(0, max);

router.get('/summary', async (_req, res) => {
  const [series, users, jobs, episodes] = await Promise.all([
    query('select count(*)::int as count from kitsune.series'),
    query('select count(*)::int as count from kitsune.users'),
    query("select count(*)::int as count from kitsune.media_jobs where status in ('queued','processing')"),
    query('select count(*)::int as count from kitsune.episodes'),
  ]);
  res.json({ series: series.rows[0].count, users: users.rows[0].count, jobs: jobs.rows[0].count, episodes: episodes.rows[0].count });
});
router.get('/users', async (_req, res) => {
  const { rows } = await query('select id,email,display_name,role,is_active,created_at from kitsune.users order by created_at desc limit 100');
  res.json({ items: rows });
});
router.patch('/users/:id', async (req, res) => {
  if (!validId(req.params.id) || (req.body?.role && !['user','developer','admin'].includes(req.body.role)) || (req.body?.isActive !== undefined && typeof req.body.isActive !== 'boolean')) return res.status(400).json({ error: 'Rol o usuario inválido' });
  const { rows } = await query('update kitsune.users set role=coalesce($1,role),is_active=coalesce($2,is_active) where id=$3 returning id,email,role,is_active', [req.body.role || null, req.body.isActive ?? null, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  await query('delete from kitsune.sessions where user_id=$1', [rows[0].id]);
  await query('insert into kitsune.audit_logs(actor_role,action,entity,entity_id) values ($1,$2,$3,$4)', ['admin','update','user',rows[0].id]);
  res.json(rows[0]);
});
router.get('/episodes', async (_req, res) => {
  const { rows } = await query(`select e.id,e.number,e.title,e.status,s.number as season_number,ser.title as series_title
    from kitsune.episodes e join kitsune.seasons s on s.id=e.season_id
    join kitsune.series ser on ser.id=s.series_id order by ser.title,s.number,e.number limit 100`);
  res.json({ items: rows });
});
router.post('/episodes', async (req, res) => {
  const seriesId = req.body?.seriesId;
  const seasonNumber = Number(req.body?.seasonNumber);
  const episodeNumber = Number(req.body?.episodeNumber);
  const title = short(req.body?.title);
  if (!validId(seriesId) || !Number.isInteger(seasonNumber) || seasonNumber < 1 || !Number.isInteger(episodeNumber) || episodeNumber < 1 || title.length < 2) return res.status(400).json({ error: 'Datos del episodio inválidos' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const series = await client.query('select id from kitsune.series where id=$1', [seriesId]);
    if (!series.rowCount) { await client.query('rollback'); return res.status(404).json({ error: 'Serie no encontrada' }); }
    const { rows: seasons } = await client.query(`insert into kitsune.seasons(series_id,number,title) values ($1,$2,$3)
      on conflict (series_id,number) do update set title=kitsune.seasons.title returning id`, [seriesId, seasonNumber, `Temporada ${seasonNumber}`]);
    const { rows } = await client.query('insert into kitsune.episodes(season_id,number,title) values ($1,$2,$3) returning id,number,title,status', [seasons[0].id, episodeNumber, title]);
    await client.query('insert into kitsune.media_jobs(episode_id) values ($1)', [rows[0].id]);
    await client.query('insert into kitsune.audit_logs(actor_role,action,entity,entity_id) values ($1,$2,$3,$4)', ['admin','create','episode',rows[0].id]);
    await client.query('commit');
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') return res.status(409).json({ error: 'Ese episodio ya existe' });
    throw error;
  } finally { client.release(); }
});
router.get('/jobs', async (_req, res) => {
  const { rows } = await query(`select j.id,j.status,j.attempts,j.source_path,j.error_message,j.created_at,e.title as episode_title,ser.title as series_title
    from kitsune.media_jobs j join kitsune.episodes e on e.id=j.episode_id
    join kitsune.seasons s on s.id=e.season_id join kitsune.series ser on ser.id=s.series_id
    order by j.created_at desc limit 100`);
  res.json({ items: rows });
});
router.post('/jobs/:id/retry', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Trabajo inválido' });
  const { rows } = await query("update kitsune.media_jobs set status='queued',attempts=attempts+1,error_message=null,updated_at=now() where id=$1 and status='failed' returning id,status", [req.params.id]);
  if (!rows[0]) return res.status(409).json({ error: 'Solo se pueden reintentar trabajos fallidos' });
  res.json(rows[0]);
});
export default router;
