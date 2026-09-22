import { Router } from 'express';
import { query } from './db.js';
import { requireRole } from './auth.js';

const router = Router();
const slugify = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const safeText = (value, max) => String(value || '').trim().slice(0, max);

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
router.get('/series/:slug', async (req, res) => {
  const { rows } = await query(`select id,slug,title,synopsis,genres,poster_path,trailer_path
    from kitsune.series where slug=$1 and status='published'`, [req.params.slug]);
  if (!rows[0]) return res.status(404).json({ error: 'Serie no encontrada' });
  const seasons = await query(`select s.id,s.number,s.title,e.id as episode_id,e.number as episode_number,e.title as episode_title,e.duration_seconds,e.status
    from kitsune.seasons s left join kitsune.episodes e on e.season_id=s.id and e.status='published'
    where s.series_id=$1 order by s.number,e.number`, [rows[0].id]);
  res.json({ ...rows[0], seasons: seasons.rows });
});
router.get('/admin/series', requireRole('admin'), async (_req, res) => {
  const { rows } = await query('select id,slug,title,status,genres,poster_path,trailer_path from kitsune.series order by created_at desc limit 100');
  res.json({ items: rows });
});
router.post('/admin/series', requireRole('admin'), async (req, res) => {
  const title = safeText(req.body?.title, 160);
  const slug = slugify(title);
  if (title.length < 2 || !slug) return res.status(400).json({ error: 'Título inválido' });
  try {
    const { rows } = await query(`insert into kitsune.series(slug,title,genres,status) values ($1,$2,$3,'draft') returning id,slug,title,status`, [slug, title, Array.isArray(req.body?.genres) ? req.body.genres.map(x => safeText(x, 40)).slice(0, 5) : []]);
    await query('insert into kitsune.audit_logs(actor_role,action,entity,entity_id) values ($1,$2,$3,$4)', ['admin','create','series',rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'La serie ya existe' });
    throw error;
  }
});
router.patch('/admin/series/:id', requireRole('admin'), async (req, res) => {
  const status = req.body?.status;
  if (!['draft','published','hidden'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
  const { rows } = await query('update kitsune.series set status=$1,updated_at=now() where id=$2 returning id,title,status', [status, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Serie no encontrada' });
  await query('insert into kitsune.audit_logs(actor_role,action,entity,entity_id) values ($1,$2,$3,$4)', ['admin',status,'series',rows[0].id]);
  res.json(rows[0]);
});
router.delete('/admin/series/:id', requireRole('admin'), async (req, res) => {
  const { rows } = await query('delete from kitsune.series where id=$1 returning id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Serie no encontrada' });
  await query('insert into kitsune.audit_logs(actor_role,action,entity,entity_id) values ($1,$2,$3,$4)', ['admin','delete','series',rows[0].id]);
  res.json({ ok: true });
});
router.get('/admin/audit', requireRole('admin'), async (_req, res) => {
  const { rows } = await query('select action,entity,entity_id,created_at from kitsune.audit_logs order by created_at desc limit 100');
  res.json({ items: rows });
});
export default router;
