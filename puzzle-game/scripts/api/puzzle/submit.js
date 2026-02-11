import { json, readJsonBody } from "../_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "../_lib/neon.js";
import { upsertPuzzleProgress } from "../_lib/puzzleProgress.js";
import { PUZZLE_TYPE, evaluateSubmission, getTodayDateKey } from "../../shared/dailyPuzzle.js";

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

function calculateScore({ solved, hintsUsed, elapsedSeconds }) {
  if (!solved) {
    return 0;
  }

  const hintPenalty = hintsUsed * 10;
  const timePenalty = Math.floor(elapsedSeconds / 20);
  return Math.max(10, 100 - hintPenalty - timePenalty);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(req);
    const hasPuzzleDate = Boolean(body.puzzleDate);
    const puzzleDate = normalizeDateKey(body.puzzleDate) || getTodayDateKey();
    const userId = body.userId ? String(body.userId).trim() : "";
    const hintsUsed = toNonNegativeInteger(body.hintsUsed);
    const elapsedSeconds = toNonNegativeInteger(body.elapsedSeconds);

    if (hasPuzzleDate && !normalizeDateKey(body.puzzleDate)) {
      return json(res, 400, { ok: false, error: "Invalid puzzleDate" });
    }

    const evaluation = evaluateSubmission(puzzleDate, body.answers);
    const score = calculateScore({
      solved: evaluation.solved,
      hintsUsed,
      elapsedSeconds,
    });

    let persisted = false;

    if (userId && isDatabaseConfigured()) {
      const sql = getSqlClient();
      await upsertPuzzleProgress(sql, {
        userId,
        puzzleDate: evaluation.puzzle.date,
        puzzleType: PUZZLE_TYPE,
        status: evaluation.solved ? "completed" : "attempted",
        score,
        hintsUsed,
        elapsedSeconds,
      });
      persisted = true;
    }

    return json(res, 200, {
      ok: true,
      solved: evaluation.solved,
      score,
      correctCells: evaluation.correctEditableCells,
      totalCells: evaluation.totalEditableCells,
      puzzleDate: evaluation.puzzle.date,
      puzzleType: PUZZLE_TYPE,
      persisted,
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to submit puzzle",
    });
  }
}
