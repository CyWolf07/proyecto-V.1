import { createHash } from 'node:crypto';

const maxAttempts = 12;
const ipHash = ip => createHash('sha256').update(ip).digest('hex');

// El UPSERT bloquea la fila de la IP durante esta operación atómica.
const reserveAttemptSql = `
  insert into kitsune.login_attempts as bucket (ip_hash, attempts, expires_at)
  values ($1, 1, statement_timestamp() + interval '15 minutes')
  on conflict (ip_hash) do update set
    attempts = case
      when bucket.expires_at <= statement_timestamp() then 1
      else least(bucket.attempts + 1, $2 + 1)
    end,
    expires_at = case
      when bucket.expires_at <= statement_timestamp()
        then statement_timestamp() + interval '15 minutes'
      else bucket.expires_at
    end
  returning attempts <= $2 as allowed,
    greatest(1, ceil(extract(epoch from expires_at - statement_timestamp())))::integer as retry_after_seconds
`;

export function createLoginLimit(query) {
  return async (req, res, next) => {
    try {
      const { rows } = await query(reserveAttemptSql, [ipHash(req.ip || 'unknown'), maxAttempts]);
      const attempt = rows[0];
      if (!attempt) throw new Error('No se pudo reservar el intento de acceso');
      if (!attempt.allowed) {
        res.set('Retry-After', String(attempt.retry_after_seconds));
        return res.status(429).json({ error: 'Demasiados intentos. Prueba de nuevo cuando termine el bloqueo.' });
      }
      next();
    } catch (error) {
      // Un error del límite compartido impide seguir con la autenticación.
      next(error);
    }
  };
}

export async function pruneLoginAttempts(query) {
  await query('delete from kitsune.login_attempts where expires_at < statement_timestamp()');
}
