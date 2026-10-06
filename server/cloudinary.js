import { Router } from 'express';
import { pool } from './db.js';
import { cloudinarySettings, verifyNotification, validManifestUrl } from './cloudinary-signatures.js';

export const cloudinaryWebhook = Router();
cloudinaryWebhook.post('/webhook', async (req, res) => {
  const settings = cloudinarySettings();
  if (!settings.ready || !req.rawBody || !verifyNotification(req.rawBody,
    req.get('x-cld-timestamp'), req.get('x-cld-signature'), settings.apiSecret)) {
    return res.status(401).json({ error: 'Notificación no válida' });
  }
  const event = req.body;
  if (event?.notification_type !== 'eager' || !Array.isArray(event.eager) || typeof event.public_id !== 'string') {
    return res.status(400).json({ error: 'Notificación no compatible' });
  }
  const manifest = event.eager.find(item => item.format === 'm3u8' || String(item.secure_url || '').endsWith('.m3u8'))?.secure_url;
  if (!validManifestUrl(manifest, settings.cloudName)) return res.status(400).json({ error: 'Manifiesto no válido' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const job = await client.query(`select id,episode_id,status from kitsune.media_jobs
      where source_path=$1 for update`, [event.public_id]);
    if (!job.rows[0]) { await client.query('rollback'); return res.status(404).json({ error: 'Trabajo no encontrado' }); }
    if (job.rows[0].status === 'ready') { await client.query('commit'); return res.json({ ok: true }); }
    if (job.rows[0].status !== 'processing') { await client.query('rollback'); return res.status(409).json({ error: 'Trabajo no procesable' }); }
    await client.query("update kitsune.media_jobs set status='ready',updated_at=now() where id=$1", [job.rows[0].id]);
    await client.query("update kitsune.episodes set hls_url=$1,status='ready' where id=$2 and status='processing'", [manifest, job.rows[0].episode_id]);
    await client.query(`insert into kitsune.audit_logs(actor_role,action,entity,entity_id)
      values ('system','ready','episode',$1)`, [job.rows[0].episode_id]);
    await client.query('commit'); res.json({ ok: true });
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
});
