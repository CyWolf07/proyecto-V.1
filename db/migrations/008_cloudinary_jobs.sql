create unique index if not exists media_jobs_source_path_unique_idx
  on kitsune.media_jobs(source_path) where source_path is not null;
