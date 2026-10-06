import { Router } from 'express';
import { query, pool } from './db.js';
import { requireRole } from './auth.js';

const router = Router();
const slugify = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const safeText = (value, max) => String(value || '').trim().slice(0, max);
const validId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const safeAsset = value => value === null || (typeof value === 'string' && /^\/assets\/[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/.test(value));

async function audit(client, req, action, entity, id) {
  await client.query('insert into kitsune.audit_logs(actor_id,actor_role,action,entity,entity_id) values ($1,$2,$3,$4,$5)',
    [req.session.user_id, req.session.role, action, entity, id]);
}

router.get('/series', async (req, res) => {
  const q = safeText(req.query.q, 80);
  const genre = safeText(req.query.genre, 40);
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 48) : 24;
  const { rows } = await query(`select id,slug,title,synopsis,genres,poster_path,trailer_path,created_at
    from kitsune.series where status='published'
    and ($1='' or title ilike '%'||$1||'%' or $1=any(genres))
    and ($2='' or $2=any(genres))
    order by created_at, title limit $3`, [q, genre, limit]);
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60').json({ items: rows });
});
router.get('/home', async (req, res) => {
  const userId = req.session?.user_id || null;
  const [latest, popular, recommended, continueWatching] = await Promise.all([
    query(`select ser.id,ser.slug,ser.title,ser.poster_path,e.id as episode_id,
      s.number as season_number,e.number as episode_number,e.title as episode_title
      from kitsune.series ser join kitsune.seasons s on s.series_id=ser.id
      join kitsune.episodes e on e.season_id=s.id
      where ser.status='published' and e.status='published'
      order by e.created_at desc,e.id desc limit 8`),
    query(`select ser.id,ser.slug,ser.title,ser.poster_path,count(f.user_id)::int as favorites
      from kitsune.series ser left join kitsune.favorites f on f.series_id=ser.id
      where ser.status='published' group by ser.id order by favorites desc,ser.created_at desc limit 8`),
    query(`select ser.id,ser.slug,ser.title,ser.poster_path,
      (select count(*) from unnest(ser.genres) genre where genre=any(mine.genres))::int as affinity
      from kitsune.series ser
      cross join lateral (select coalesce(array_agg(distinct genre),array[]::text[]) as genres
        from kitsune.favorites f join kitsune.series liked on liked.id=f.series_id
        cross join lateral unnest(liked.genres) genre where f.user_id=$1) mine
      where ser.status='published' and not exists
        (select 1 from kitsune.favorites own where own.user_id=$1 and own.series_id=ser.id)
      order by affinity desc,ser.created_at desc limit 8`, [userId]),
    userId ? query(`select ser.id,ser.slug,ser.title,ser.poster_path,e.id as episode_id,e.title as episode_title,
        p.position_seconds,p.updated_at from kitsune.watch_progress p
        join kitsune.episodes e on e.id=p.episode_id
        join kitsune.seasons s on s.id=e.season_id
        join kitsune.series ser on ser.id=s.series_id
        where p.user_id=$1 and e.status='published' and ser.status='published'
        order by p.updated_at desc limit 8`, [userId]) : Promise.resolve({ rows: [] }),
  ]);
  res.json({ latest: latest.rows, popular: popular.rows, recommended: recommended.rows, continueWatching: continueWatching.rows });
});
router.get('/series/:slug', async (req, res) => {
  const { rows } = await query(`select id,slug,title,synopsis,genres,poster_path,trailer_path
    from kitsune.series where slug=$1 and status='published'`, [req.params.slug]);
  if (!rows[0]) return res.status(404).json({ error: 'Serie no encontrada' });
  const seasons = await query(`select s.id,s.number,s.title,e.id as episode_id,e.number as episode_number,e.title as episode_title,e.duration_seconds,e.status
    from kitsune.seasons s left join kitsune.episodes e on e.season_id=s.id and e.status='published'
    where s.series_id=$1 order by s.number,e.number`, [rows[0].id]);
  res.json({ ...rows[0], seasons: seasons.rows });
});
router.get('/episodes/:id/playback', async (req, res) => {
  if (!req.session) return res.status(401).json({ error: 'Inicia sesión para reproducir este episodio' });
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Episodio inválido' });
  const { rows } = await query(`select e.hls_url from kitsune.episodes e
    join kitsune.seasons s on s.id=e.season_id join kitsune.series ser on ser.id=s.series_id
    where e.id=$1 and e.status='published' and ser.status='published' and e.hls_url is not null
    and exists (select 1 from kitsune.media_jobs j where j.episode_id=e.id and j.status='ready')`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Episodio no disponible' });
  res.set('Cache-Control', 'no-store').json({ url: rows[0].hls_url,
    warning: 'En este prototipo gratuito el enlace de reproducción es compartible' });
});
router.get('/admin/series', requireRole('admin'), async (_req, res) => {
  const { rows } = await query('select id,slug,title,synopsis,status,genres,poster_path,trailer_path from kitsune.series order by created_at desc limit 100');
  res.json({ items: rows });
});
router.post('/admin/series', requireRole('admin'), async (req, res) => {
  const title = safeText(req.body?.title, 160);
  const slug = slugify(title);
  const synopsis = safeText(req.body?.synopsis, 2000);
  const genres = Array.isArray(req.body?.genres) ? req.body.genres.map(x => safeText(x, 40)).filter(Boolean).slice(0, 5) : [];
  if (title.length < 2 || !slug || (req.body?.genres !== undefined && !Array.isArray(req.body.genres))) return res.status(400).json({ error: 'Datos de la serie inválidos' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`insert into kitsune.series(slug,title,synopsis,genres,status)
      values ($1,$2,$3,$4,'draft') returning id,slug,title,status`, [slug, title, synopsis, genres]);
    await audit(client, req, 'create', 'series', rows[0].id);
    await client.query('commit');
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') return res.status(409).json({ error: 'La serie ya existe' });
    throw error;
  } finally { client.release(); }
});
router.patch('/admin/series/:id', requireRole('admin'), async (req, res) => {
  if (!validId(req.params.id) || !req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Serie inválida' });
  const allowed = ['title','synopsis','genres','status','posterPath','trailerPath'];
  const fields = Object.keys(req.body);
  if (!fields.length || fields.some(field => !allowed.includes(field))) return res.status(400).json({ error: 'Campos inválidos' });
  const values = [];
  const updates = [];
  const add = (column, value) => { values.push(value); updates.push(`${column}=$${values.length}`); };
  if ('title' in req.body) {
    const title = safeText(req.body.title, 160);
    if (title.length < 2 || !slugify(title)) return res.status(400).json({ error: 'Título inválido' });
    add('title', title); add('slug', slugify(title));
  }
  if ('synopsis' in req.body) add('synopsis', safeText(req.body.synopsis, 2000));
  if ('genres' in req.body) {
    if (!Array.isArray(req.body.genres) || req.body.genres.length > 5 || req.body.genres.some(genre => typeof genre !== 'string')) return res.status(400).json({ error: 'Géneros inválidos' });
    add('genres', req.body.genres.map(genre => safeText(genre, 40)).filter(Boolean));
  }
  if ('status' in req.body) {
    if (!['draft','published','hidden'].includes(req.body.status)) return res.status(400).json({ error: 'Estado inválido' });
    add('status', req.body.status);
  }
  for (const [field, column] of [['posterPath','poster_path'],['trailerPath','trailer_path']]) {
    if (field in req.body) {
      if (!safeAsset(req.body[field])) return res.status(400).json({ error: 'Ruta de recurso inválida' });
      add(column, req.body[field]);
    }
  }
  values.push(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(`update kitsune.series set ${updates.join(',')},updated_at=now()
      where id=$${values.length} returning id,slug,title,synopsis,genres,status,poster_path,trailer_path`, values);
    if (!rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Serie no encontrada' }); }
    await audit(client, req, 'update', 'series', rows[0].id);
    await client.query('commit');
    res.json(rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una serie con ese título' });
    throw error;
  } finally { client.release(); }
});
router.delete('/admin/series/:id', requireRole('admin'), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Serie inválida' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query('delete from kitsune.series where id=$1 returning id', [req.params.id]);
    if (!rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Serie no encontrada' }); }
    await audit(client, req, 'delete', 'series', rows[0].id);
    await client.query('commit');
    res.json({ ok: true });
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
});
router.get('/admin/audit', requireRole('admin'), async (_req, res) => {
  const { rows } = await query('select actor_id,actor_role,action,entity,entity_id,created_at from kitsune.audit_logs order by created_at desc limit 100');
  res.json({ items: rows });
});
export default router;
