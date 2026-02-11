import { neon } from "@neondatabase/serverless";

let sqlClient;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}
