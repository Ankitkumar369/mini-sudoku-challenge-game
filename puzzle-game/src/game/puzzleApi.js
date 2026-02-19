// Imports: environment config and shared deterministic puzzle fallback.
import { env } from "../lib/env";
import { createDailyPuzzle } from "../../shared/dailyPuzzle";

function makeApiUrl(path) {
  const base = env.apiBaseUrl || "";
  return `${base}${path}`;
}

export async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export async function fetchTodayPuzzle() {
  const params = new URLSearchParams({
    tzOffsetMinutes: String(new Date().getTimezoneOffset() * -1),
  });
  const response = await fetch(makeApiUrl(`/api/puzzle/today?${params.toString()}`), { method: "GET" });
  const payload = await parseJsonResponse(response);

  if (!payload.puzzle) {
    throw new Error("Puzzle payload is missing");
  }

  // Local puzzle is fallback and date guard for timezone mismatch.
  const localPuzzle = createDailyPuzzle();
  return payload.puzzle.date === localPuzzle.date ? payload.puzzle : localPuzzle;
}

export async function submitPuzzleToApi(body) {
  const response = await fetch(makeApiUrl("/api/puzzle/submit"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
}

export async function saveProgressToApi(body) {
  const response = await fetch(makeApiUrl("/api/progress/save"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
}

export async function syncDailyScoresToApi(body) {
  const response = await fetch(makeApiUrl("/api/sync/daily-scores"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
}

export async function loadHistoryFromApi(userId) {
  const params = new URLSearchParams({ userId });
  const response = await fetch(makeApiUrl(`/api/progress?${params.toString()}`), {
    method: "GET",
  });
  const payload = await parseJsonResponse(response);
  return Array.isArray(payload.history) ? payload.history : [];
}
