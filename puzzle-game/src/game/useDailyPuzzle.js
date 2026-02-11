import { useCallback, useEffect, useMemo, useState } from "react";
import { env } from "../lib/env";
import {
  clearPuzzleProgress,
  getPuzzleProgress,
  setPuzzleProgress,
} from "../lib/localProgress";
import {
  GRID_SIZE,
  createDailyPuzzle,
  createInitialGrid,
  evaluateSubmission,
  findHintCell,
} from "../../shared/dailyPuzzle";

function makeApiUrl(path) {
  const base = env.apiBaseUrl || "";
  return `${base}${path}`;
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function normalizeCellValue(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= GRID_SIZE ? number : null;
}

function sanitizeGridFromProgress(givens, rawGrid) {
  const initial = createInitialGrid(givens);

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (givens[row][col] !== null) {
        initial[row][col] = givens[row][col];
      } else {
        initial[row][col] = normalizeCellValue(rawGrid?.[row]?.[col]);
      }
    }
  }

  return initial;
}

function calculateScore(solved, hintsUsed, elapsedSeconds) {
  if (!solved) {
    return 0;
  }

  const hintPenalty = hintsUsed * 10;
  const timePenalty = Math.floor(elapsedSeconds / 20);
  return Math.max(10, 100 - hintPenalty - timePenalty);
}

async function fetchTodayPuzzle() {
  const response = await fetch(makeApiUrl("/api/puzzle/today"), { method: "GET" });
  const payload = await parseJsonResponse(response);

  if (!payload.puzzle) {
    throw new Error("Puzzle payload is missing");
  }

  return payload.puzzle;
}

async function submitPuzzleToApi(body) {
  const response = await fetch(makeApiUrl("/api/puzzle/submit"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
}

async function saveProgressToApi(body) {
  const response = await fetch(makeApiUrl("/api/progress/save"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
}

async function loadHistoryFromApi(userId) {
  const params = new URLSearchParams({ userId });
  const response = await fetch(makeApiUrl(`/api/progress?${params.toString()}`), {
    method: "GET",
  });
  const payload = await parseJsonResponse(response);
  return Array.isArray(payload.history) ? payload.history : [];
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : "Unexpected puzzle error";
}

export function useDailyPuzzle(user) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [puzzle, setPuzzle] = useState(null);
  const [grid, setGrid] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [error, setError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [nowMs, setNowMs] = useState(Date.now());

  const persistLocalState = useCallback(async (nextState) => {
    if (!nextState?.puzzleDate) {
      return;
    }

    await setPuzzleProgress(nextState.puzzleDate, {
      grid: nextState.grid,
      hintsUsed: nextState.hintsUsed,
      startedAt: nextState.startedAt,
      status: nextState.status,
      score: nextState.score || 0,
      updatedAt: Date.now(),
    });
  }, []);

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setError("");
    setSubmitResult(null);

    try {
      let nextPuzzle;

      try {
        nextPuzzle = await fetchTodayPuzzle();
      } catch {
        nextPuzzle = createDailyPuzzle();
      }

      const cached = await getPuzzleProgress(nextPuzzle.date);
      const nextGrid = sanitizeGridFromProgress(nextPuzzle.givens, cached?.grid);
      const nextHintsUsed = Number(cached?.hintsUsed) || 0;
      const nextStartedAt = Number(cached?.startedAt) || Date.now();

      setPuzzle(nextPuzzle);
      setGrid(nextGrid);
      setHintsUsed(nextHintsUsed);
      setStartedAt(nextStartedAt);

      if (cached?.status === "completed") {
        setSubmitResult({
          solved: true,
          score: Number(cached.score) || 0,
          message: "Puzzle already completed for today.",
          persisted: false,
        });
      }
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  useEffect(() => {
    if (!user?.id) {
      setHistory([]);
      return;
    }

    let cancelled = false;

    loadHistoryFromApi(user.id)
      .then((items) => {
        if (!cancelled) {
          setHistory(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const cellStats = useMemo(() => {
    if (!puzzle) {
      return { totalEditable: 0, filledEditable: 0 };
    }

    let totalEditable = 0;
    let filledEditable = 0;

    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        if (puzzle.givens[row][col] === null) {
          totalEditable += 1;
          if (grid[row]?.[col] !== null) {
            filledEditable += 1;
          }
        }
      }
    }

    return { totalEditable, filledEditable };
  }, [puzzle, grid]);

  const elapsedSeconds = useMemo(() => {
    return Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  }, [nowMs, startedAt]);

  const updateCell = useCallback(
    async (row, col, value) => {
      if (!puzzle || puzzle.givens[row][col] !== null) {
        return;
      }

      const normalized = normalizeCellValue(value);
      const nextGrid = grid.map((gridRow, rowIndex) =>
        gridRow.map((cell, colIndex) => {
          if (rowIndex === row && colIndex === col) {
            return normalized;
          }

          return cell;
        })
      );

      setGrid(nextGrid);
      setSubmitResult(null);

      await persistLocalState({
        puzzleDate: puzzle.date,
        grid: nextGrid,
        hintsUsed,
        startedAt,
        status: "in_progress",
      }).catch(() => {});
    },
    [grid, hintsUsed, persistLocalState, puzzle, startedAt]
  );

  const useHint = useCallback(async () => {
    if (!puzzle) {
      return;
    }

    const hint = findHintCell(puzzle.date, grid);

    if (!hint) {
      setSubmitResult({
        solved: true,
        score: calculateScore(true, hintsUsed, elapsedSeconds),
        message: "No hint needed. Puzzle already solved.",
        persisted: false,
      });
      return;
    }

    const nextGrid = grid.map((gridRow, rowIndex) =>
      gridRow.map((cell, colIndex) => {
        if (rowIndex === hint.row && colIndex === hint.col) {
          return hint.value;
        }

        return cell;
      })
    );

    const nextHintsUsed = hintsUsed + 1;
    setGrid(nextGrid);
    setHintsUsed(nextHintsUsed);
    setSubmitResult(null);

    await persistLocalState({
      puzzleDate: puzzle.date,
      grid: nextGrid,
      hintsUsed: nextHintsUsed,
      startedAt,
      status: "in_progress",
    }).catch(() => {});
  }, [elapsedSeconds, grid, hintsUsed, persistLocalState, puzzle, startedAt]);

  const resetPuzzle = useCallback(async () => {
    if (!puzzle) {
      return;
    }

    const initialGrid = createInitialGrid(puzzle.givens);
    setGrid(initialGrid);
    setHintsUsed(0);
    setStartedAt(Date.now());
    setSubmitResult(null);

    await clearPuzzleProgress(puzzle.date).catch(() => {});
  }, [puzzle]);

  const submitPuzzle = useCallback(async () => {
    if (!puzzle) {
      return;
    }

    setSubmitting(true);
    setError("");

    const liveElapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

    try {
      let payload;

      try {
        payload = await submitPuzzleToApi({
          userId: user?.id || "",
          puzzleDate: puzzle.date,
          answers: grid,
          hintsUsed,
          elapsedSeconds: liveElapsedSeconds,
        });
      } catch {
        const localResult = evaluateSubmission(puzzle.date, grid);
        payload = {
          solved: localResult.solved,
          score: calculateScore(localResult.solved, hintsUsed, liveElapsedSeconds),
          correctCells: localResult.correctEditableCells,
          totalCells: localResult.totalEditableCells,
          persisted: false,
        };
      }

      const solved = Boolean(payload.solved);
      const nextStatus = solved ? "completed" : "attempted";
      const message = solved
        ? `Solved. Score ${payload.score}.`
        : `Not solved yet (${payload.correctCells}/${payload.totalCells} correct editable cells).`;

      setSubmitResult({
        solved,
        score: payload.score || 0,
        message,
        persisted: Boolean(payload.persisted),
      });

      await persistLocalState({
        puzzleDate: puzzle.date,
        grid,
        hintsUsed,
        startedAt,
        status: nextStatus,
        score: payload.score || 0,
      }).catch(() => {});

      if (user?.id) {
        loadHistoryFromApi(user.id)
          .then((items) => setHistory(items))
          .catch(() => {});
      }
    } catch (submitError) {
      setError(toErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }, [grid, hintsUsed, persistLocalState, puzzle, startedAt, user?.id]);

  const syncProgress = useCallback(async () => {
    if (!puzzle || !user?.id) {
      return;
    }

    setSyncing(true);
    const liveElapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

    try {
      await saveProgressToApi({
        userId: user.id,
        puzzleDate: puzzle.date,
        status: "in_progress",
        hintsUsed,
        score: 0,
        elapsedSeconds: liveElapsedSeconds,
      });
      setSubmitResult({
        solved: false,
        score: 0,
        message: "Progress synced to backend.",
        persisted: true,
      });
      const items = await loadHistoryFromApi(user.id);
      setHistory(items);
    } catch {
      await persistLocalState({
        puzzleDate: puzzle.date,
        grid,
        hintsUsed,
        startedAt,
        status: "in_progress",
        score: 0,
      }).catch(() => {});

      setSubmitResult({
        solved: false,
        score: 0,
        message: "Backend sync unavailable. Progress saved locally.",
        persisted: false,
      });

      setError("");
    } finally {
      setSyncing(false);
    }
  }, [grid, hintsUsed, persistLocalState, puzzle, startedAt, user?.id]);

  const summary = useMemo(() => {
    const completed = history.filter((entry) => entry.status === "completed");
    const attempted = history.filter((entry) => entry.status !== "completed");
    const bestScore = completed.reduce((best, entry) => Math.max(best, entry.score || 0), 0);
    const averageTimeSeconds =
      completed.length > 0
        ? Math.floor(
            completed.reduce((total, entry) => total + (entry.elapsedSeconds || 0), 0) /
              completed.length
          )
        : 0;

    return {
      completedCount: completed.length,
      attemptedCount: attempted.length,
      bestScore,
      averageTimeSeconds,
    };
  }, [history]);

  return {
    loading,
    submitting,
    syncing,
    puzzle,
    grid,
    hintsUsed,
    elapsedSeconds,
    error,
    submitResult,
    history,
    summary,
    cellStats,
    updateCell,
    useHint,
    submitPuzzle,
    syncProgress,
    resetPuzzle,
    reloadPuzzle: loadPuzzle,
  };
}
