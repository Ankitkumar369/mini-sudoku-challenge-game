// Imports: JSON response helper and deterministic daily puzzle generator.
import { json } from "../_lib/http.js";
import { createDailyPuzzle, getTodayDateKey } from "../../shared/dailyPuzzle.js";

function getDateKeyFromOffset(offsetMinutes) {
  const parsedOffset = Number(offsetMinutes);

  if (!Number.isFinite(parsedOffset) || parsedOffset < -12 * 60 || parsedOffset > 14 * 60) {
    // Invalid/missing timezone offset falls back to server-side today.
    return getTodayDateKey();
  }

  // Shift UTC clock by user offset so everyone gets their local "today" puzzle.
  const shifted = new Date(Date.now() + parsedOffset * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const puzzleType = req.query?.type ? String(req.query.type) : "";
    const dateKey = getDateKeyFromOffset(req.query?.tzOffsetMinutes);
    // Deterministic generation: same date + type => same puzzle.
    const puzzle = createDailyPuzzle(dateKey, puzzleType);
    return json(res, 200, { ok: true, puzzle });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load daily puzzle",
    });
  }
}
