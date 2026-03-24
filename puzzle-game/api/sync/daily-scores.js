// Imports: HTTP/DB helpers, input validators, and default puzzle type.
import { json, readJsonBody } from "../_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "../_lib/neon.js";
import { upsertPuzzleProgress } from "../_lib/puzzleProgress.js";
import { clampInteger, normalizeDateKey, toInteger } from "../_lib/validation.js";
import { PUZZLE_TYPE } from "../../shared/dailyPuzzle.js";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  isAllowedMutationOrigin,
} from "../_lib/guards.js";

function validateDateIsNotFuture(dateKey) {
  // Allow today's and local edge-case tomorrow UTC boundary only.
  const inputDate = new Date(`${dateKey}T00:00:00.000Z`);
  const now = new Date();
  const tomorrowUtcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return inputDate <= tomorrowUtcDate;
}

function isPlausibleTimeTaken(seconds) {
  // Solved puzzle under 10s is treated as suspicious and rejected.
  return seconds >= 10 && seconds <= 6 * 60 * 60;
}

export default async function handler(req, res) {
  const rateInfo = checkRateLimit(req, { key: "sync-daily-scores", max: 25, windowMs: 60 * 1000 });
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
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (!userId) {
      return json(res, 400, { ok: false, error: "userId is required" });
    }

    if (entries.length === 0) {
      return json(res, 400, { ok: false, error: "entries are required" });
    }

    if (entries.length > 100) {
      return json(res, 400, { ok: false, error: "Too many entries in a single sync request" });
    }

    const normalizedEntries = entries
      .map((entry) => {
        const date = normalizeDateKey(entry?.date);
        const rawScore = toInteger(entry.score);
        const rawTimeTaken = toInteger(entry.timeTaken);
        const solved = Boolean(entry.solved);

        if (!date || !validateDateIsNotFuture(date)) {
          return null;
        }

        if (rawScore === null || rawScore < 0 || rawScore > 100) {
          return null;
        }

        if (rawTimeTaken === null || rawTimeTaken < 0 || rawTimeTaken > 6 * 60 * 60) {
          return null;
        }

        if (solved && !isPlausibleTimeTaken(rawTimeTaken)) {
          return null;
        }

        return {
          date,
          score: clampInteger(rawScore, 0, 100),
          timeTaken: clampInteger(rawTimeTaken, 0, 6 * 60 * 60),
          solved,
        };
      })
      .filter(Boolean);

    if (normalizedEntries.length === 0) {
      return json(res, 400, { ok: false, error: "No valid entries" });
    }

    if (!isDatabaseConfigured()) {
      // Accept payload in demo mode even when DB is missing.
      return json(res, 200, {
        ok: true,
        persisted: false,
        acceptedCount: normalizedEntries.length,
      });
    }

    const sql = getSqlClient();

    // Upsert per date prevents duplicate writes for same day sync retries.
    for (const entry of normalizedEntries) {
      await upsertPuzzleProgress(sql, {
        userId,
        puzzleDate: entry.date,
        puzzleType: PUZZLE_TYPE,
        status: entry.solved ? "completed" : "attempted",
        score: entry.score,
        hintsUsed: 0,
        elapsedSeconds: entry.timeTaken,
      });
    }

    return json(res, 200, {
      ok: true,
      persisted: true,
      acceptedCount: normalizedEntries.length,
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to sync daily scores",
    });
  }
}
