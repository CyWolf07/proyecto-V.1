import pg from 'pg';
import { readFileSync } from 'node:fs';
import { loadConfig } from './config.js';

const config = loadConfig();

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DATABASE_CA_FILE
    ? { ca: readFileSync(process.env.DATABASE_CA_FILE, 'utf8'), rejectUnauthorized: true }
    : { rejectUnauthorized: false },
});

pool.on('error', (error) => console.error('Conexión PostgreSQL inactiva:', error.message));

export const query = (sql, params = []) => pool.query(sql, params);
