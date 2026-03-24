// Imports: HTTP helpers, DB utilities, validators, and shared puzzle evaluator.
import { json, readJsonBody } from "../_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "../_lib/neon.js";
import { upsertPuzzleProgress } from "../_lib/puzzleProgress.js";
import { normalizeOptionalDateKey, toNonNegativeInteger } from "../_lib/validation.js";
import { evaluateSubmission, getTodayDateKey } from "../../shared/dailyPuzzle.js";

// Same scoring formula is used for local fallback and API result.
function calculateScore({ solved, hintsUsed, elapsedSeconds }) {
  if (!solved) {
    return 0;
  }

  const hintPenalty = hintsUsed * 10;
  const timePenalty = Math.floor(elapsedSeconds / 20);
  return Math.max(10, 100 - hintPenalty - timePenalty);
}

function isValidElapsedSeconds(value) {
  return value >= 0 && value <= 6 * 60 * 60;
}

function isValidHints(value) {
  return value >= 0 && value <= 10;
}

function parseSubmitPayload(body) {
  // puzzleDate is optional; invalid custom value should be rejected explicitly.
  const parsedDate = normalizeOptionalDateKey(body.puzzleDate);
  const hasPuzzleDate = Boolean(body.puzzleDate);
  const userId = body.userId ? String(body.userId).trim() : "";
  const puzzleType = body.puzzleType ? String(body.puzzleType).trim() : "";

  return {
    hasPuzzleDate,
    puzzleDate: parsedDate || getTodayDateKey(),
    parsedDate,
    userId,
    puzzleType,
    hintsUsed: toNonNegativeInteger(body.hintsUsed),
    elapsedSeconds: toNonNegativeInteger(body.elapsedSeconds),
    answers: body.answers,
  };
}

function validateSubmitPayload(payload) {
  if (payload.hasPuzzleDate && !payload.parsedDate) {
    return "Invalid puzzleDate";
  }

  if (!isValidElapsedSeconds(payload.elapsedSeconds)) {
    return "elapsedSeconds out of range";
  }

  if (!isValidHints(payload.hintsUsed)) {
    return "hintsUsed out of range";
  }

  return "";
}

async function persistSolvedProgress(payload, evaluation, score) {
  // Persist only solved attempts; failed tries stay client-side to reduce DB writes.
  if (!evaluation.solved || !payload.userId || !isDatabaseConfigured()) {
    return false;
  }

  const sql = getSqlClient();
  await upsertPuzzleProgress(sql, {
    userId: payload.userId,
    puzzleDate: evaluation.puzzle.date,
    puzzleType: evaluation.puzzle.puzzleType,
    status: "completed",
    score,
    hintsUsed: payload.hintsUsed,
    elapsedSeconds: payload.elapsedSeconds,
  });

  return true;
}

function createSubmitResponse(evaluation, score, persisted) {
  return {
    ok: true,
    solved: evaluation.solved,
    score,
    correctCells: evaluation.correctEditableCells,
    totalCells: evaluation.totalEditableCells,
    ruleViolations: evaluation.ruleViolations,
    puzzleDate: evaluation.puzzle.date,
    puzzleType: evaluation.puzzle.puzzleType,
    persisted,
  };
}

async function handleSubmit(body) {
  const payload = parseSubmitPayload(body);
  const validationError = validateSubmitPayload(payload);

  if (validationError) {
    return {
      statusCode: 400,
      response: { ok: false, error: validationError },
    };
  }

  const evaluation = evaluateSubmission(payload.puzzleDate, payload.answers, payload.puzzleType);
  const score = calculateScore({
    solved: evaluation.solved,
    hintsUsed: payload.hintsUsed,
    elapsedSeconds: payload.elapsedSeconds,
  });
  const persisted = await persistSolvedProgress(payload, evaluation, score);

  return {
    statusCode: 200,
    response: createSubmitResponse(evaluation, score, persisted),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    // Parse request body and return unified response shape.
    const body = await readJsonBody(req);
    const result = await handleSubmit(body);
    return json(res, result.statusCode, result.response);
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to submit puzzle",
    });
  }
}
