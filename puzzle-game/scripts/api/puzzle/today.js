import { json } from "../_lib/http.js";
import { createDailyPuzzle, getTodayDateKey } from "../../shared/dailyPuzzle.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const puzzle = createDailyPuzzle(getTodayDateKey());
    return json(res, 200, { ok: true, puzzle });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load daily puzzle",
    });
  }
}
