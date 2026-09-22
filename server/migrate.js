import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { pool } from './db.js';

const folder = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const client = await pool.connect();
try {
  await client.query('select pg_advisory_lock($1)', [416093]);
  await client.query('create schema if not exists kitsune');
  await client.query(`create table if not exists kitsune.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  for (const name of (await readdir(folder)).filter(x => x.endsWith('.sql')).sort()) {
    const exists = await client.query('select 1 from kitsune.schema_migrations where name=$1', [name]);
    if (exists.rowCount) continue;
    await client.query('begin');
    try {
      await client.query(await readFile(join(folder, name), 'utf8'));
      await client.query('insert into kitsune.schema_migrations(name) values ($1)', [name]);
      await client.query('commit');
      console.log(`Migración aplicada: ${name}`);
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.query('select pg_advisory_unlock($1)', [416093]).catch(() => {});
  client.release();
  await pool.end();
}
