// Imports: JSON helper and database connectivity utilities.
import { json } from "./_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "./_lib/neon.js";
import { applyRateLimitHeaders, checkRateLimit } from "./_lib/guards.js";

export default async function handler(req, res) {
  const rateInfo = checkRateLimit(req, { key: "health", max: 120, windowMs: 60 * 1000 });
  applyRateLimitHeaders(res, rateInfo);

  if (!rateInfo.allowed) {
    return json(res, 429, { ok: false, error: "Too many requests. Please retry shortly." });
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!isDatabaseConfigured()) {
    return json(res, 200, {
      ok: true,
      apiReachable: true,
      databaseConfigured: false,
      databaseConnected: false,
      message: "API is running. DATABASE_URL is not set.",
    });
  }

  try {
    const sql = getSqlClient();
    const rows = await sql`select now() as now`;

    return json(res, 200, {
      ok: true,
      apiReachable: true,
      databaseConfigured: true,
      databaseConnected: true,
      databaseTime: rows[0]?.now || null,
    });
  } catch (error) {
    return json(res, 200, {
      ok: true,
      apiReachable: true,
      databaseConfigured: true,
      databaseConnected: false,
      error: error instanceof Error ? error.message : "Health check failed",
    });
  }
}
