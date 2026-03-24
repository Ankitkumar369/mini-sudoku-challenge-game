// Imports: environment config and shared deterministic puzzle fallback.
import { env } from "../lib/env";
import { createDailyPuzzle } from "../../shared/dailyPuzzle";

function makeApiUrl(path) {
  const base = env.apiBaseUrl || "";
  return `${base}${path}`;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, options = {}, config = {}) {
  const retries = Number.isFinite(Number(config.retries)) ? Math.max(0, Number(config.retries)) : 2;
  const initialDelayMs = Number.isFinite(Number(config.initialDelayMs))
    ? Math.max(100, Number(config.initialDelayMs))
    : 350;
  const timeoutMs = Number.isFinite(Number(config.timeoutMs)) ? Math.max(1000, Number(config.timeoutMs)) : 12000;
  const retryStatusSet = new Set(config.retryOnStatus || [429, 500, 502, 503, 504]);

  let attempt = 0;

  while (attempt <= retries) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      if (!retryStatusSet.has(response.status) || attempt === retries) {
        return response;
      }
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
    }

    const delayMs = initialDelayMs * 2 ** attempt;
    await wait(delayMs);
    attempt += 1;
  }

  return fetchWithTimeout(url, options, timeoutMs);
}

export async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export async function fetchTodayPuzzle(puzzleType = "") {
  const params = new URLSearchParams({
    tzOffsetMinutes: String(new Date().getTimezoneOffset() * -1),
  });

  if (puzzleType) {
    params.set("type", String(puzzleType));
  }
  const response = await fetch(makeApiUrl(`/api/puzzle/today?${params.toString()}`), { method: "GET" });
  const payload = await parseJsonResponse(response);

  if (!payload.puzzle) {
    throw new Error("Puzzle payload is missing");
  }

  // Local puzzle is fallback and date guard for timezone mismatch.
  const localPuzzle = createDailyPuzzle(undefined, puzzleType);
  return payload.puzzle.date === localPuzzle.date ? payload.puzzle : localPuzzle;
}

export async function submitPuzzleToApi(body) {
  const response = await fetchWithRetry(
    makeApiUrl("/api/puzzle/submit"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    { retries: 1, initialDelayMs: 300, timeoutMs: 12000 }
  );

  return parseJsonResponse(response);
}

export async function saveProgressToApi(body) {
  const response = await fetchWithRetry(
    makeApiUrl("/api/progress/save"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    { retries: 2, initialDelayMs: 400, timeoutMs: 12000 }
  );

  return parseJsonResponse(response);
}

export async function syncDailyScoresToApi(body) {
  const response = await fetchWithRetry(
    makeApiUrl("/api/sync/daily-scores"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    { retries: 3, initialDelayMs: 500, timeoutMs: 15000 }
  );

  return parseJsonResponse(response);
}

export async function loadHistoryFromApi(userId) {
  const params = new URLSearchParams({ userId });
  const response = await fetchWithRetry(
    makeApiUrl(`/api/progress?${params.toString()}`),
    {
      method: "GET",
    },
    { retries: 1, initialDelayMs: 300, timeoutMs: 12000 }
  );
  const payload = await parseJsonResponse(response);
  return Array.isArray(payload.history) ? payload.history : [];
}
