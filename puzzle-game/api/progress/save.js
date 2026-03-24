// Imports: HTTP/DB helpers, input normalization, and puzzle type resolver.
import { json, readJsonBody } from "../_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "../_lib/neon.js";
import { upsertPuzzleProgress } from "../_lib/puzzleProgress.js";
import { normalizeOptionalDateKey, toNonNegativeInteger } from "../_lib/validation.js";
import { getPuzzleTypeForDate, getTodayDateKey } from "../../shared/dailyPuzzle.js";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  isAllowedMutationOrigin,
} from "../_lib/guards.js";

const ALLOWED_STATUS = new Set(["in_progress", "attempted", "completed"]);

function isReasonableProgressPayload({ status, elapsedSeconds, hintsUsed, score }) {
  return (
    ALLOWED_STATUS.has(status) &&
    elapsedSeconds >= 0 &&
    elapsedSeconds <= 6 * 60 * 60 &&
    hintsUsed >= 0 &&
    hintsUsed <= 10 &&
    score >= 0 &&
    score <= 100
  );
}

export default async function handler(req, res) {
  const rateInfo = checkRateLimit(req, { key: "progress-save", max: 40, windowMs: 60 * 1000 });
  applyRateLimitHeaders(res, rateInfo);

  if (!rateInfo.allowed) {
    return json(res, 429, { ok: false, error: "Too many requests. Please retry shortly." });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!isAllowedMutationOrigin(req)) {
    return json(res, 403, { ok: false, error: "Origin not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const userId = String(body.userId || "").trim();

    if (!userId) {
      return json(res, 400, { error: "userId is required" });
    }

    if (!isDatabaseConfigured()) {
      // Frontend still stores progress locally; this flag informs UI.
      return json(res, 200, { ok: true, persisted: false });
    }

    const hasPuzzleDate = Boolean(body.puzzleDate);
    const normalizedPuzzleDate = normalizeOptionalDateKey(body.puzzleDate);
    const puzzleDate = normalizedPuzzleDate || getTodayDateKey();
    const elapsedSeconds = toNonNegativeInteger(body.elapsedSeconds);
    const status = body.status ? String(body.status).trim() : "in_progress";
    const score = toNonNegativeInteger(body.score);
    const hintsUsed = toNonNegativeInteger(body.hintsUsed);
    const requestedPuzzleType = body.puzzleType ? String(body.puzzleType).trim() : "";
    const puzzleType = requestedPuzzleType || getPuzzleTypeForDate(puzzleDate);

    if (hasPuzzleDate && !normalizedPuzzleDate) {
      return json(res, 400, { ok: false, error: "Invalid puzzleDate" });
    }

    if (!isReasonableProgressPayload({ status, elapsedSeconds, hintsUsed, score })) {
      return json(res, 400, { ok: false, error: "Invalid progress payload" });
    }

    const sql = getSqlClient();

    // Upsert keeps one snapshot per user/date/type.
    await upsertPuzzleProgress(sql, {
      userId,
      puzzleDate,
      puzzleType,
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
