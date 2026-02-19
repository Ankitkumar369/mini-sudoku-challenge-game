// Imports: response helper and progress-table DB utilities.
import { json } from "../_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "../_lib/neon.js";
import { ensurePuzzleProgressTable } from "../_lib/puzzleProgress.js";

function toDateKey(value) {
  if (!value) {
    return "";
  }

  const source = value instanceof Date ? value : new Date(value);
  return Number.isNaN(source.getTime()) ? "" : source.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const userId = String(req.query?.userId || "").trim();

  if (!userId) {
    return json(res, 400, { error: "userId is required" });
  }

  if (!isDatabaseConfigured()) {
    // Read endpoint stays functional even without DB (offline/demo-safe mode).
    return json(res, 200, { ok: true, persisted: false, history: [] });
  }

  try {
    const sql = getSqlClient();
    // Ensure table exists before querying in fresh deployment.
    await ensurePuzzleProgressTable(sql);

    const rows = await sql`
      select user_id, puzzle_date, puzzle_type, status, score, hints_used, elapsed_seconds, updated_at
      from puzzle_progress
      where user_id = ${userId}
      order by puzzle_date desc
      limit 14;
    `;

    const history = rows.map((row) => ({
      userId: row.user_id,
      puzzleDate: toDateKey(row.puzzle_date),
      puzzleType: row.puzzle_type,
      status: row.status,
      score: Number(row.score) || 0,
      hintsUsed: Number(row.hints_used) || 0,
      elapsedSeconds: Number(row.elapsed_seconds) || 0,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));

    return json(res, 200, { ok: true, persisted: true, history });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load progress",
    });
  }
}
