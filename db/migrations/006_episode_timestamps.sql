alter table kitsune.episodes add column if not exists created_at timestamptz not null default now();
create index if not exists episodes_published_created_idx
  on kitsune.episodes (created_at desc) where status='published';
