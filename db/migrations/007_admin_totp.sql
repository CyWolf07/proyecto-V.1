create table if not exists kitsune.totp_replay (
  identity text primary key,
  last_step bigint not null
);
