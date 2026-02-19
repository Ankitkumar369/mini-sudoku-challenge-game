-- Phase 1 foundation schema for Retention Puzzle Game

create table if not exists app_users (
  id text primary key,
  name text,
  email text,
  avatar_url text,
  provider text not null,
  last_seen_at timestamptz not null default now()
);

create table if not exists puzzle_progress (
  user_id text not null references app_users(id) on delete cascade,
  puzzle_date date not null,
  puzzle_type text not null,
  status text not null,
  score integer not null default 0,
  hints_used integer not null default 0,
  elapsed_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, puzzle_date, puzzle_type)
);
