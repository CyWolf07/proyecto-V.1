import { Router } from 'express';
import { query, pool } from './db.js';
import { requireRole } from './auth.js';
import { randomUUID } from 'node:crypto';
import { cloudinarySettings, signUpload } from './cloudinary-signatures.js';

const router = Router();
router.use(requireRole('admin'));
const validId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const short = (value, max = 160) => String(value || '').trim().slice(0, max);
const audit = (client, req, action, entity, id) => client.query(
  'insert into kitsune.audit_logs(actor_id,actor_role,action,entity,entity_id) values ($1,$2,$3,$4,$5)',
  [req.session.user_id, req.session.role, action, entity, id]);

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
  if (!validId(req.params.id) || (req.body?.role && !['user','developer'].includes(req.body.role)) || (req.body?.isActive !== undefined && typeof req.body.isActive !== 'boolean')) return res.status(400).json({ error: 'Rol o usuario inválido; el acceso admin solo se configura en el servidor' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query('update kitsune.users set role=coalesce($1,role),is_active=coalesce($2,is_active) where id=$3 returning id,email,role,is_active', [req.body.role || null, req.body.isActive ?? null, req.params.id]);
    if (!rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Usuario no encontrado' }); }
    await client.query('delete from kitsune.sessions where user_id=$1', [rows[0].id]);
    await audit(client, req, 'update', 'user', rows[0].id);
    await client.query('commit');
    res.json(rows[0]);
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
});
router.get('/seasons', async (req, res) => {
  if (!validId(req.query.seriesId)) return res.status(400).json({ error: 'Serie inválida' });
  const { rows } = await query('select id,series_id,number,title from kitsune.seasons where series_id=$1 order by number', [req.query.seriesId]);
  res.json({ items: rows });
});
router.post('/seasons', async (req, res) => {
  const seriesId = req.body?.seriesId;
  const number = Number(req.body?.number);
  const title = short(req.body?.title);
  if (!validId(seriesId) || !Number.isInteger(number) || number < 1 || !title) return res.status(400).json({ error: 'Datos de temporada inválidos' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`insert into kitsune.seasons(series_id,number,title)
      select id,$2,$3 from kitsune.series where id=$1 returning id,series_id,number,title`, [seriesId, number, title]);
    if (!rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Serie no encontrada' }); }
    await audit(client, req, 'create', 'season', rows[0].id);
    await client.query('commit');
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') return res.status(409).json({ error: 'Esa temporada ya existe' });
    throw error;
  } finally { client.release(); }
});
router.patch('/seasons/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Temporada inválida' });
  const title = req.body?.title === undefined ? null : short(req.body.title);
  const number = req.body?.number === undefined ? null : Number(req.body.number);
  if ((title !== null && !title) || (number !== null && (!Number.isInteger(number) || number < 1)) || (title === null && number === null)) return res.status(400).json({ error: 'Datos de temporada inválidos' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`update kitsune.seasons set title=coalesce($1,title),number=coalesce($2,number)
      where id=$3 returning id,series_id,number,title`, [title, number, req.params.id]);
    if (!rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Temporada no encontrada' }); }
    await audit(client, req, 'update', 'season', rows[0].id);
    await client.query('commit');
    res.json(rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') return res.status(409).json({ error: 'Ese número de temporada ya existe' });
    throw error;
  } finally { client.release(); }
});
router.delete('/seasons/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Temporada inválida' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query('delete from kitsune.seasons where id=$1 returning id', [req.params.id]);
    if (!rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Temporada no encontrada' }); }
    await audit(client, req, 'delete', 'season', rows[0].id);
    await client.query('commit'); res.json({ ok: true });
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
});
router.get('/episodes', async (_req, res) => {
  const { rows } = await query(`select e.id,e.number,e.title,e.status,e.hls_url,s.id as season_id,s.number as season_number,ser.title as series_title
    from kitsune.episodes e join kitsune.seasons s on s.id=e.season_id
    join kitsune.series ser on ser.id=s.series_id order by ser.title,s.number,e.number limit 100`);
  res.json({ items: rows });
});
router.post('/episodes/:id/video-upload', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Episodio inválido' });
  const settings = cloudinarySettings();
  if (!settings.ready) return res.status(503).json({ error: 'Cloudinary no está configurado: faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET o PUBLIC_BASE_URL' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const episode = await client.query('select id,status from kitsune.episodes where id=$1 for update', [req.params.id]);
    if (!episode.rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Episodio no encontrado' }); }
    if (episode.rows[0].status === 'published') { await client.query('rollback'); return res.status(409).json({ error: 'Despublica el episodio antes de reemplazar el video' }); }
    await client.query(`update kitsune.media_jobs set status='failed',error_message='Subida o conversión vencida',updated_at=now()
      where episode_id=$1 and status='processing' and source_path is not null
      and created_at<=now()-interval '2 hours'`, [req.params.id]);
    const active = await client.query(`select id from kitsune.media_jobs where episode_id=$1
      and status='processing' and source_path is not null and created_at>now()-interval '2 hours' limit 1`, [req.params.id]);
    if (active.rowCount) { await client.query('rollback'); return res.status(409).json({ error: 'Ya hay una subida en proceso para este episodio' }); }
    const publicId = `kitsune/episodes/${req.params.id}/${randomUUID()}`;
    await client.query(`insert into kitsune.media_jobs(episode_id,source_path,status)
      values ($1,$2,'processing')`, [req.params.id, publicId]);
    await client.query("update kitsune.episodes set status='processing',hls_url=null where id=$1", [req.params.id]);
    await audit(client, req, 'upload_started', 'episode', req.params.id);
    await client.query('commit');
    const params = {
      eager: 'sp_hd/m3u8', eager_async: 'true',
      eager_notification_url: `${settings.baseUrl}/api/v1/cloudinary/webhook`,
      overwrite: 'false', public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    res.json({ cloudName: settings.cloudName, apiKey: settings.apiKey, params,
      signature: signUpload(params, settings.apiSecret) });
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
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
    const createdSeason = await client.query(`insert into kitsune.seasons(series_id,number,title) values ($1,$2,$3)
      on conflict (series_id,number) do nothing returning id`, [seriesId, seasonNumber, `Temporada ${seasonNumber}`]);
    const seasons = createdSeason.rows.length ? createdSeason.rows : (await client.query(
      'select id from kitsune.seasons where series_id=$1 and number=$2', [seriesId, seasonNumber])).rows;
    if (createdSeason.rows.length) await audit(client, req, 'create', 'season', seasons[0].id);
    const { rows } = await client.query('insert into kitsune.episodes(season_id,number,title) values ($1,$2,$3) returning id,number,title,status', [seasons[0].id, episodeNumber, title]);
    await audit(client, req, 'create', 'episode', rows[0].id);
    await client.query('commit');
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') return res.status(409).json({ error: 'Ese episodio ya existe' });
    throw error;
  } finally { client.release(); }
});
router.patch('/episodes/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Episodio inválido' });
  const title = req.body?.title === undefined ? null : short(req.body.title);
  const number = req.body?.number === undefined ? null : Number(req.body.number);
  const status = req.body?.status ?? null;
  if ((title !== null && title.length < 2) || (number !== null && (!Number.isInteger(number) || number < 1)) ||
      (status !== null && !['draft','published'].includes(status)) || (title === null && number === null && status === null)) {
    return res.status(400).json({ error: 'Datos del episodio inválidos' });
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const existing = await client.query('select id,hls_url from kitsune.episodes where id=$1 for update', [req.params.id]);
    if (!existing.rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Episodio no encontrado' }); }
    if (status === 'published') {
      const ready = await client.query("select 1 from kitsune.media_jobs where episode_id=$1 and status='ready' limit 1", [req.params.id]);
      if (!existing.rows[0].hls_url || !ready.rowCount) {
        await client.query('rollback');
        return res.status(409).json({ error: 'El vídeo debe terminar de procesarse antes de publicar el episodio' });
      }
    }
    const { rows } = await client.query(`update kitsune.episodes
      set title=coalesce($1,title),number=coalesce($2,number),status=coalesce($3,status)
      where id=$4 returning id,number,title,status`, [title, number, status, req.params.id]);
    await audit(client, req, status === 'published' ? 'publish' : 'update', 'episode', rows[0].id);
    await client.query('commit'); res.json(rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') return res.status(409).json({ error: 'Ese número de episodio ya existe' });
    throw error;
  } finally { client.release(); }
});
router.delete('/episodes/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Episodio inválido' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query('delete from kitsune.episodes where id=$1 returning id', [req.params.id]);
    if (!rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Episodio no encontrado' }); }
    await audit(client, req, 'delete', 'episode', rows[0].id);
    await client.query('commit'); res.json({ ok: true });
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
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
  res.status(409).json({ error: 'Para reintentar un trabajo fallido, vuelve a subir el MP4 desde Episodios' });
});
export default router;
