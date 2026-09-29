create table if not exists kitsune.login_attempts (
  ip_hash text primary key check (length(ip_hash) = 64),
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null
);

create index if not exists login_attempts_expires_at_idx
  on kitsune.login_attempts (expires_at);
