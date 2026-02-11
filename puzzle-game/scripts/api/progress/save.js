import { json, readJsonBody } from "../_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "../_lib/neon.js";
import { upsertPuzzleProgress } from "../_lib/puzzleProgress.js";
import { PUZZLE_TYPE, getTodayDateKey } from "../../shared/dailyPuzzle.js";

function toNonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.floor(number));
}

function normalizeDateKey(value) {
  const candidate = String(value || "").trim();

  if (!candidate) {
    return null;
  }

  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const userId = String(body.userId || "").trim();

    if (!userId) {
      return json(res, 400, { error: "userId is required" });
    }

    if (!isDatabaseConfigured()) {
      return json(res, 200, { ok: true, persisted: false });
    }

    const hasPuzzleDate = Boolean(body.puzzleDate);
    const puzzleDate = normalizeDateKey(body.puzzleDate) || getTodayDateKey();
    const elapsedSeconds = toNonNegativeInteger(body.elapsedSeconds);
    const status = body.status ? String(body.status) : "in_progress";
    const score = toNonNegativeInteger(body.score);
    const hintsUsed = toNonNegativeInteger(body.hintsUsed);

    if (hasPuzzleDate && !normalizeDateKey(body.puzzleDate)) {
      return json(res, 400, { ok: false, error: "Invalid puzzleDate" });
    }

    const sql = getSqlClient();

    await upsertPuzzleProgress(sql, {
      userId,
      puzzleDate,
      puzzleType: PUZZLE_TYPE,
      status,
      score,
      hintsUsed,
      elapsedSeconds,
    });

    return json(res, 200, { ok: true, persisted: true });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save progress",
    });
  }
}
