import pg from 'pg';
import { readFileSync } from 'node:fs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está configurada');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DATABASE_CA_FILE
    ? { ca: readFileSync(process.env.DATABASE_CA_FILE, 'utf8'), rejectUnauthorized: true }
    : { rejectUnauthorized: false },
});

pool.on('error', (error) => console.error('Conexión PostgreSQL inactiva:', error.message));

export const query = (sql, params = []) => pool.query(sql, params);
