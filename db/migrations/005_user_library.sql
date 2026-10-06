create table if not exists kitsune.favorites (
  user_id uuid not null references kitsune.users(id) on delete cascade,
  series_id uuid not null references kitsune.series(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

create index if not exists favorites_user_created_idx
  on kitsune.favorites (user_id, created_at desc);

create index if not exists watch_progress_user_updated_idx
  on kitsune.watch_progress (user_id, updated_at desc);
