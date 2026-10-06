import { Router } from 'express';
import { query } from './db.js';

const router = Router();
const validId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

router.use((req, res, next) => req.session?.user_id
  ? next()
  : res.status(401).json({ error: 'Inicia sesión para usar tu biblioteca' }));

router.get('/favorites', async (req, res) => {
  const { rows } = await query(`select ser.id,ser.slug,ser.title,ser.genres,ser.poster_path,f.created_at
    from kitsune.favorites f join kitsune.series ser on ser.id=f.series_id
    where f.user_id=$1 and ser.status='published'
    order by f.created_at desc limit 100`, [req.session.user_id]);
  res.json({ items: rows });
});

router.put('/favorites/:seriesId', async (req, res) => {
  if (!validId(req.params.seriesId)) return res.status(400).json({ error: 'Serie inválida' });
  const { rows } = await query(`insert into kitsune.favorites(user_id,series_id)
    select $1,id from kitsune.series where id=$2 and status='published'
    on conflict (user_id,series_id) do update set created_at=kitsune.favorites.created_at
    returning series_id`, [req.session.user_id, req.params.seriesId]);
  if (!rows[0]) return res.status(404).json({ error: 'Serie no disponible' });
  res.json({ ok: true });
});

router.delete('/favorites/:seriesId', async (req, res) => {
  if (!validId(req.params.seriesId)) return res.status(400).json({ error: 'Serie inválida' });
  await query('delete from kitsune.favorites where user_id=$1 and series_id=$2', [req.session.user_id, req.params.seriesId]);
  res.json({ ok: true });
});

router.get('/history', async (req, res) => {
  const { rows } = await query(`select p.episode_id,p.position_seconds,p.updated_at,
      e.title as episode_title,e.duration_seconds,e.number as episode_number,
      s.number as season_number,ser.id as series_id,ser.slug,ser.title as series_title,ser.poster_path
    from kitsune.watch_progress p
    join kitsune.episodes e on e.id=p.episode_id
    join kitsune.seasons s on s.id=e.season_id
    join kitsune.series ser on ser.id=s.series_id
    where p.user_id=$1 and ser.status='published' and e.status='published'
    order by p.updated_at desc limit 100`, [req.session.user_id]);
  res.json({ items: rows });
});

router.put('/progress/:episodeId', async (req, res) => {
  if (!validId(req.params.episodeId)) return res.status(400).json({ error: 'Episodio inválido' });
  const seconds = Number(req.body?.positionSeconds);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 86_400) return res.status(400).json({ error: 'Posición inválida' });
  const { rows } = await query(`insert into kitsune.watch_progress(user_id,episode_id,position_seconds)
    select $1,e.id,least($3::integer,coalesce(e.duration_seconds,$3::integer))
    from kitsune.episodes e
    join kitsune.seasons s on s.id=e.season_id
    join kitsune.series ser on ser.id=s.series_id
    where e.id=$2 and e.status='published' and ser.status='published'
    on conflict (user_id,episode_id) do update
      set position_seconds=excluded.position_seconds,updated_at=now()
    returning episode_id,position_seconds,updated_at`, [req.session.user_id, req.params.episodeId, seconds]);
  if (!rows[0]) return res.status(404).json({ error: 'Episodio no disponible' });
  res.json(rows[0]);
});

router.get('/progress/:episodeId', async (req, res) => {
  if (!validId(req.params.episodeId)) return res.status(400).json({ error: 'Episodio inválido' });
  const { rows } = await query('select position_seconds,updated_at from kitsune.watch_progress where user_id=$1 and episode_id=$2', [req.session.user_id, req.params.episodeId]);
  res.json({ positionSeconds: rows[0]?.position_seconds ?? 0, updatedAt: rows[0]?.updated_at ?? null });
});

export default router;
