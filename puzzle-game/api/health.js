import { json } from "./_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "./_lib/neon.js";

export default async function handler(req, res) {
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
