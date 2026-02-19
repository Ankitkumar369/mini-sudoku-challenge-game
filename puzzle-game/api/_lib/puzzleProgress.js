// Imports: shared puzzle type constant for DB row defaults.
import { PUZZLE_TYPE } from "../../shared/dailyPuzzle.js";

// Base user table used by progress rows (kept minimal for auth-provider flexibility).
const CREATE_USERS_TABLE_SQL = `
  create table if not exists app_users (
    id text primary key,
    name text,
    email text,
    avatar_url text,
    provider text not null,
    last_seen_at timestamptz not null default now()
  );
`;

// Main progress table: one row per user + date + puzzle type.
const CREATE_PROGRESS_TABLE_SQL = `
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
`;

// Safe migration for existing deployments.
const ALTER_PROGRESS_TABLE_SQL = `
  alter table puzzle_progress
  add column if not exists elapsed_seconds integer not null default 0;
`;

export async function ensurePuzzleProgressTable(sql) {
  // Idempotent DDL calls: safe to run on every request before writes.
  await sql(CREATE_USERS_TABLE_SQL);
  await sql(CREATE_PROGRESS_TABLE_SQL);
  await sql(ALTER_PROGRESS_TABLE_SQL);
}

export async function ensureUserExists(sql, userId) {
  if (!userId) {
    return;
  }

  // Upsert user heartbeat so progress rows always have a valid FK.
  await sql(CREATE_USERS_TABLE_SQL);
  await sql`
    insert into app_users (id, provider, last_seen_at)
    values (${userId}, 'unknown', now())
    on conflict (id)
    do update set last_seen_at = now();
  `;
}

export async function upsertPuzzleProgress(sql, entry) {
  // Ensure schema + FK parent before inserting progress.
  await ensurePuzzleProgressTable(sql);
  await ensureUserExists(sql, entry.userId);

  // Upsert keeps latest progress for same day/type, avoiding duplicate writes.
  await sql`
    insert into puzzle_progress (
      user_id,
      puzzle_date,
      puzzle_type,
      status,
      score,
      hints_used,
      elapsed_seconds,
      updated_at
    )
    values (
      ${entry.userId},
      ${entry.puzzleDate},
      ${entry.puzzleType || PUZZLE_TYPE},
      ${entry.status},
      ${entry.score},
      ${entry.hintsUsed},
      ${entry.elapsedSeconds || 0},
      now()
    )
    on conflict (user_id, puzzle_date, puzzle_type)
    do update set
      status = excluded.status,
      score = excluded.score,
      hints_used = excluded.hints_used,
      elapsed_seconds = excluded.elapsed_seconds,
      updated_at = now();
  `;
}
