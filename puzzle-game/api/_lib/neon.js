// Imports: Neon serverless SQL client factory.
import { neon } from "@neondatabase/serverless";

let sqlClient;

function normalizeDatabaseUrl(rawValue) {
  const candidate = String(rawValue || "").trim();

  if (!candidate) {
    return "";
  }

  // Handles accidental pastes like: psql 'postgresql://...'
  const extracted = candidate.match(/(postgres(?:ql)?:\/\/[^'"`\s]+)/i)?.[1] || candidate;

  // Remove wrapping quotes only when present.
  return extracted.replace(/^['"`]|['"`]$/g, "");
}

// Health checks and handlers use this to decide DB fallback behavior.
export function isDatabaseConfigured() {
  return Boolean(normalizeDatabaseUrl(process.env.DATABASE_URL));
}

export function getSqlClient() {
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // Reuse one client in serverless runtime to avoid recreating per request.
  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}
