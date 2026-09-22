create schema if not exists kitsune;
revoke all on schema kitsune from public, anon, authenticated;

create table if not exists kitsune.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('user','admin','developer')),
  created_at timestamptz not null default now()
);

create table if not exists kitsune.sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid references kitsune.users(id) on delete cascade,
  role text not null check (role in ('user','admin','developer')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_expires_at_idx on kitsune.sessions(expires_at);

create table if not exists kitsune.series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  synopsis text not null default '',
  genres text[] not null default '{}',
  poster_path text,
  trailer_path text,
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists series_published_created_idx on kitsune.series(created_at desc) where status='published';
create index if not exists series_genres_idx on kitsune.series using gin(genres);

create table if not exists kitsune.seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references kitsune.series(id) on delete cascade,
  number integer not null check (number > 0),
  title text not null,
  unique (series_id, number)
);
create table if not exists kitsune.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references kitsune.seasons(id) on delete cascade,
  number integer not null check (number > 0),
  title text not null,
  duration_seconds integer check (duration_seconds >= 0),
  hls_url text,
  status text not null default 'draft' check (status in ('draft','processing','ready','published')),
  unique (season_id, number)
);

create table if not exists kitsune.watch_progress (
  user_id uuid not null references kitsune.users(id) on delete cascade,
  episode_id uuid not null references kitsune.episodes(id) on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

create table if not exists kitsune.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references kitsune.users(id) on delete set null,
  actor_role text not null,
  action text not null,
  entity text not null,
  entity_id text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on kitsune.audit_logs(created_at desc);

insert into kitsune.series (slug,title,genres,poster_path,trailer_path,status) values
('astral-edge','Astral Edge',array['Acción','Sci-Fi'],'/assets/hero-astral-edge.png',null,'published'),
('solo-leveling','Solo Leveling',array['Acción','Fantasía'],'/assets/solo-leveling.png',null,'published'),
('the-seven-deadly-sins','The Seven Deadly Sins',array['Acción','Fantasía'],'/assets/seven-deadly-sins.png',null,'published'),
('demon-slayer','Demon Slayer: Kimetsu no Yaiba',array['Acción','Aventura'],'/assets/demon-slayer.png',null,'published'),
('mushoku-tensei','Mushoku Tensei: Jobless Reincarnation',array['Fantasía','Aventura'],'/assets/mushoku-tensei.png','/assets/trailers/mushoku-tensei-season-3.mp4','published'),
('darling-in-the-franxx','Darling in the Franxx',array['Sci-Fi','Romance'],'/assets/darling-in-the-franxx.png',null,'published'),
('classroom-of-the-elite','Classroom of the Elite',array['Drama','Misterio'],'/assets/classroom-of-the-elite.png',null,'published')
on conflict (slug) do nothing;
