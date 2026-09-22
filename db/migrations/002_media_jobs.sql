create table if not exists kitsune.media_jobs (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references kitsune.episodes(id) on delete cascade,
  source_path text,
  status text not null default 'queued' check (status in ('queued','processing','ready','failed')),
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_jobs_queue_idx on kitsune.media_jobs(created_at) where status='queued';
