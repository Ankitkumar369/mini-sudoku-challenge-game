// Imports: Neon serverless SQL client factory.
import { neon } from "@neondatabase/serverless";

let sqlClient;

// Health checks and handlers use this to decide DB fallback behavior.
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // Reuse one client in serverless runtime to avoid recreating per request.
  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}
