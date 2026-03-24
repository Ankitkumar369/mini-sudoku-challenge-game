// Imports: gameplay state dependencies, local storage helpers, and API adapters.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDailyProgress,
  clearPuzzleProgress,
  getDailyActivityEntries,
  getPuzzleProgress,
  getUnsyncedDailyActivityEntries,
  markDailyActivityEntriesSynced,
  setPuzzleProgress,
  unlockAchievement,
  upsertDailyActivityEntry,
} from "../lib/localProgress";
import {
  DAILY_STAGES,
  GRID_SIZE,
  createDailyPuzzle,
  createInitialGrid,
  evaluateSubmission,
  findHintCell,
  getGridValidationState,
} from "../../shared/dailyPuzzle";
import { calculateCurrentStreak } from "../heatmap/heatmapLogic";
import {
  calculateElapsedSeconds,
  calculateScore,
  deriveDifficultyLevel,
  isOnline,
  normalizeCellValue,
  sanitizeGridFromProgress,
  toErrorMessage,
} from "./puzzleHelpers";
import {
  fetchTodayPuzzle,
  loadHistoryFromApi,
  saveProgressToApi,
  submitPuzzleToApi,
  syncDailyScoresToApi,
} from "./puzzleApi";

const SYNC_BATCH_SIZE = 5;

function getStageProgressKey(dateKey, puzzleType) {
  return `${dateKey}:${puzzleType}`;
}

function buildStageStatuses(dateKey, progressMap) {
  let previousCompleted = true;

  return DAILY_STAGES.map((stage) => {
    const key = getStageProgressKey(dateKey, stage.puzzleType);
    const stageRecord = progressMap[key];
    const completed = stageRecord?.status === "completed";
    const unlocked = stage.stageNumber === 1 ? true : previousCompleted;

    previousCompleted = previousCompleted && completed;

    return {
      ...stage,
      key,
      unlocked,
      completed,
    };
  });
}

export function useDailyPuzzle(user) {
  const [loading, setLoading] = useState(true);
  const [selectedStageType, setSelectedStageType] = useState(DAILY_STAGES[0].puzzleType);
  const [stageStatuses, setStageStatuses] = useState([]);
  const [stageEvaluations, setStageEvaluations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [puzzle, setPuzzle] = useState(null);
  const [grid, setGrid] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [error, setError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [activityEntries, setActivityEntries] = useState([]);
  const [latestAchievement, setLatestAchievement] = useState("");
  const [completedElapsedSeconds, setCompletedElapsedSeconds] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  // Reads latest activity list from IndexedDB for heatmap + streak UI.
  const refreshActivityEntries = useCallback(async () => {
    try {
      const entries = await getDailyActivityEntries();
      setActivityEntries(entries);
    } catch {
      setActivityEntries([]);
    }
  }, []);

  const refreshStageStatuses = useCallback(async (dateKey) => {
    if (!dateKey) {
      setStageStatuses([]);
      setStageEvaluations([]);
      return [];
    }

    const progressMap = await getDailyProgress().catch(() => ({}));
    const next = buildStageStatuses(dateKey, progressMap);
    const evaluations = next.map((stage) => {
      const entry = progressMap[stage.key] || {};
      return {
        ...stage,
        status: entry.status || "locked",
        score: Number(entry.score) || 0,
        elapsedSeconds: Number(entry.elapsedSeconds) || 0,
        hintsUsed: Number(entry.hintsUsed) || 0,
        updatedAt: Number(entry.updatedAt) || 0,
      };
    });
    setStageStatuses(next);
    setStageEvaluations(evaluations);
    return next;
  }, []);

  const persistLocalState = useCallback(async (nextState) => {
    if (!nextState?.puzzleDate || !nextState?.puzzleType) {
      return;
    }

    const progressKey = getStageProgressKey(nextState.puzzleDate, nextState.puzzleType);

    // Save a resumable snapshot for offline-first behavior.
    await setPuzzleProgress(progressKey, {
      grid: nextState.grid,
      hintsUsed: nextState.hintsUsed,
      startedAt: nextState.startedAt || null,
      elapsedSeconds: Number.isFinite(nextState.elapsedSeconds) ? nextState.elapsedSeconds : 0,
      status: nextState.status,
      score: nextState.score || 0,
      puzzleType: nextState.puzzleType,
      updatedAt: Date.now(),
    });
  }, []);

  const maybeUnlockAchievements = useCallback(async (entries) => {
    const solvedEntries = entries.filter((entry) => entry.solved);
    const solvedCount = solvedEntries.length;
    const streak = calculateCurrentStreak(entries);
    const unlocked = [];

    if (streak >= 7 && (await unlockAchievement("streak_7", { streak: 7 }))) {
      unlocked.push("7-day streak unlocked");
    }

    if (streak >= 30 && (await unlockAchievement("streak_30", { streak: 30 }))) {
      unlocked.push("30-day streak unlocked");
    }

    if (solvedCount >= 100 && (await unlockAchievement("solved_100", { solvedCount: 100 }))) {
      unlocked.push("100 completions unlocked");
    }

    if (unlocked.length > 0) {
      setLatestAchievement(unlocked[0]);
    }
  }, []);

  const syncDailyActivity = useCallback(
    async ({ force = false } = {}) => {
      // Sync runs only for logged-in users and only when online.
      if (!user?.id || !isOnline()) {
        return { synced: 0, attempted: 0 };
      }

      const batchLimit = force ? 365 : SYNC_BATCH_SIZE;
      const entries = await getUnsyncedDailyActivityEntries(batchLimit);

      if (entries.length === 0) {
        return { synced: 0, attempted: 0 };
      }

      if (!force && entries.length < SYNC_BATCH_SIZE) {
        // Batch small updates to reduce server writes as per project guideline.
        return { synced: 0, attempted: entries.length };
      }

      const payloadEntries = entries.map((entry) => ({
        date: entry.date,
        score: entry.score,
        timeTaken: entry.timeTaken,
        solved: entry.solved,
      }));

      const payload = await syncDailyScoresToApi({
        userId: user.id,
        entries: payloadEntries,
      });

      if (payload.ok) {
        await markDailyActivityEntriesSynced(payloadEntries.map((entry) => entry.date));
        await refreshActivityEntries();
      }

      return {
        synced: payload.ok ? payloadEntries.length : 0,
        attempted: payloadEntries.length,
      };
    },
    [refreshActivityEntries, user?.id]
  );

  const recordDailyActivity = useCallback(
    async ({ date, solved, score, timeTaken, difficulty }) => {
      // Unsynced flag is kept true until backend confirms batch sync.
      await upsertDailyActivityEntry(date, {
        date,
        solved,
        score,
        timeTaken,
        difficulty,
        synced: !solved || !user?.id || !isOnline(),
      });

      await refreshActivityEntries();
    },
    [refreshActivityEntries, user?.id]
  );

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setError("");
    setSubmitResult(null);

    try {
      let nextPuzzle;

      try {
        // Primary source is API so timezone/date rules remain consistent.
        nextPuzzle = await fetchTodayPuzzle(selectedStageType);
      } catch {
        // Offline fallback uses deterministic local puzzle generation.
        nextPuzzle = createDailyPuzzle(undefined, selectedStageType);
      }

      const statuses = await refreshStageStatuses(nextPuzzle.date);
      const activeStage = statuses.find((stage) => stage.puzzleType === selectedStageType);

      if (activeStage && !activeStage.unlocked) {
        const firstUnlocked = statuses.find((stage) => stage.unlocked);

        if (firstUnlocked && firstUnlocked.puzzleType !== selectedStageType) {
          setSelectedStageType(firstUnlocked.puzzleType);
          return;
        }
      }

      const stageProgressKey = getStageProgressKey(nextPuzzle.date, selectedStageType);
      const cached =
        (await getPuzzleProgress(stageProgressKey)) || (await getPuzzleProgress(nextPuzzle.date));
      const nextGrid = sanitizeGridFromProgress(nextPuzzle.givens, cached?.grid);
      const nextHintsUsed = Number(cached?.hintsUsed) || 0;
      const cachedStartedAt = Number(cached?.startedAt);
      const nextStartedAt = Number.isFinite(cachedStartedAt) && cachedStartedAt > 0 ? cachedStartedAt : null;
      const cachedElapsedSeconds = Number(cached?.elapsedSeconds);
      const nextCompletedElapsedSeconds =
        cached?.status === "completed" &&
        Number.isFinite(cachedElapsedSeconds) &&
        cachedElapsedSeconds >= 0
          ? Math.floor(cachedElapsedSeconds)
          : null;

      setPuzzle(nextPuzzle);
      setGrid(nextGrid);
      setHintsUsed(nextHintsUsed);
      setStartedAt(nextStartedAt);
      setCompletedElapsedSeconds(nextCompletedElapsedSeconds);

      if (cached?.status === "completed") {
        // On reload, keep solved state visible instead of resetting session.
        setSubmitResult({
          solved: true,
          score: Number(cached.score) || 0,
          message: "Stage already completed for today.",
          persisted: false,
        });
      }
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [refreshStageStatuses, selectedStageType]);

  useEffect(() => {
    // Initial load: puzzle + local activity cache.
    loadPuzzle();
    refreshActivityEntries();
  }, [loadPuzzle, refreshActivityEntries]);

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
    // Lightweight timer tick used for elapsed-time display only.
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      return;
    }

    const handleOnline = () => {
      // Auto-sync queued activity when network comes back.
      syncDailyActivity({ force: false }).catch(() => {});
    };

    window.addEventListener("online", handleOnline);

    if (isOnline()) {
      handleOnline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncDailyActivity, user?.id]);

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
    if (completedElapsedSeconds !== null) {
      return completedElapsedSeconds;
    }

    return calculateElapsedSeconds(startedAt, nowMs);
  }, [completedElapsedSeconds, nowMs, startedAt]);

  const unsyncedActivityCount = useMemo(() => {
    return activityEntries.filter((entry) => entry.solved && !entry.synced).length;
  }, [activityEntries]);

  const validationState = useMemo(() => {
    if (!puzzle) {
      return {
        hasConflicts: false,
        conflictCellKeys: [],
        clueViolationKeys: [],
        duplicateCount: 0,
        clueViolationCount: 0,
        givenMismatchCount: 0,
      };
    }

    return getGridValidationState(puzzle.date, grid, puzzle.puzzleType);
  }, [grid, puzzle]);

  const updateCell = useCallback(
    async (row, col, value) => {
      if (!puzzle || puzzle.givens[row][col] !== null) {
        return;
      }

      const normalized = normalizeCellValue(value);
      const interactionStartedAt = startedAt || Date.now();
      const nextGrid = grid.map((gridRow, rowIndex) =>
        gridRow.map((cell, colIndex) => {
          if (rowIndex === row && colIndex === col) {
            return normalized;
          }

          return cell;
        })
      );

      if (!startedAt) {
        setStartedAt(interactionStartedAt);
      }
      setGrid(nextGrid);
      setSubmitResult(null);

      await persistLocalState({
        puzzleDate: puzzle.date,
        puzzleType: puzzle.puzzleType,
        grid: nextGrid,
        hintsUsed,
        startedAt: interactionStartedAt,
        elapsedSeconds: calculateElapsedSeconds(interactionStartedAt, Date.now()),
        status: "in_progress",
      }).catch(() => {});
    },
    [grid, hintsUsed, persistLocalState, puzzle, startedAt]
  );

  const useHint = useCallback(async () => {
    if (!puzzle) {
      return;
    }

    if (hintsUsed >= (puzzle.hintLimit || 0)) {
      setSubmitResult({
        solved: false,
        score: 0,
        message: `Hint limit reached (${puzzle.hintLimit || 0} per day).`,
        persisted: false,
      });
      return;
    }

    const hint = findHintCell(puzzle.date, grid, puzzle.puzzleType);

    if (!hint) {
      // If no missing cell found, puzzle is already effectively solved.
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
    const interactionStartedAt = startedAt || Date.now();
    if (!startedAt) {
      setStartedAt(interactionStartedAt);
    }
    setGrid(nextGrid);
    setHintsUsed(nextHintsUsed);
    setSubmitResult(null);

    await persistLocalState({
      puzzleDate: puzzle.date,
      puzzleType: puzzle.puzzleType,
      grid: nextGrid,
      hintsUsed: nextHintsUsed,
      startedAt: interactionStartedAt,
      elapsedSeconds: calculateElapsedSeconds(interactionStartedAt, Date.now()),
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
    setStartedAt(null);
    setCompletedElapsedSeconds(null);
    setSubmitResult(null);

    const stageProgressKey = getStageProgressKey(puzzle.date, puzzle.puzzleType);
    await clearPuzzleProgress(stageProgressKey).catch(() => {});
  }, [puzzle]);

  const submitPuzzle = useCallback(async () => {
    if (!puzzle) {
      return;
    }

    setSubmitting(true);
    setError("");

    const liveElapsedSeconds = calculateElapsedSeconds(startedAt, Date.now());

    try {
      let payload;

      try {
        // Preferred path: server validates score and can persist completion.
        payload = await submitPuzzleToApi({
          userId: user?.id || "",
          puzzleDate: puzzle.date,
          puzzleType: puzzle.puzzleType,
          answers: grid,
          hintsUsed,
          elapsedSeconds: liveElapsedSeconds,
        });
      } catch {
        // Offline/local fallback keeps gameplay uninterrupted.
        const localResult = evaluateSubmission(puzzle.date, grid, puzzle.puzzleType);
        payload = {
          solved: localResult.solved,
          score: calculateScore(localResult.solved, hintsUsed, liveElapsedSeconds),
          correctCells: localResult.correctEditableCells,
          totalCells: localResult.totalEditableCells,
          ruleViolations: localResult.ruleViolations,
          persisted: false,
        };
      }

      const solved = Boolean(payload.solved);
      const nextStatus = solved ? "completed" : "attempted";
      const score = Number(payload.score) || 0;
      const message = solved
        ? `Solved. Score ${score}.`
        : payload.ruleViolations > 0
        ? `Rules not satisfied yet. Resolve ${payload.ruleViolations} violation(s).`
        : `Not solved yet (${payload.correctCells}/${payload.totalCells} correct editable cells).`;

      setSubmitResult({
        solved,
        score,
        message,
        persisted: Boolean(payload.persisted),
      });
      setCompletedElapsedSeconds(solved ? liveElapsedSeconds : null);

      await persistLocalState({
        puzzleDate: puzzle.date,
        puzzleType: puzzle.puzzleType,
        grid,
        hintsUsed,
        startedAt,
        elapsedSeconds: liveElapsedSeconds,
        status: nextStatus,
        score,
      }).catch(() => {});

      const nextStatuses = await refreshStageStatuses(puzzle.date).catch(() => []);
      const completedStages = nextStatuses.filter((stage) => stage.completed).length;
      const totalStages = nextStatuses.length || DAILY_STAGES.length;
      const allStagesComplete = totalStages > 0 && completedStages === totalStages;

      const solvedMessage = allStagesComplete
        ? `Daily run completed. ${completedStages}/${totalStages} stages clear. Score ${score}.`
        : `Stage clear. ${completedStages}/${totalStages} stages completed.`;

      if (solved) {
        setSubmitResult({
          solved: true,
          score,
          message: solvedMessage,
          persisted: Boolean(payload.persisted),
        });

        if (!allStagesComplete) {
          const nextUnlockedStage = nextStatuses.find((stage) => stage.unlocked && !stage.completed);

          if (nextUnlockedStage && nextUnlockedStage.puzzleType !== puzzle.puzzleType) {
            setSelectedStageType(nextUnlockedStage.puzzleType);
          }
        }
      }

      const difficulty = deriveDifficultyLevel(solved, hintsUsed, liveElapsedSeconds, score);
      await recordDailyActivity({
        date: puzzle.date,
        solved: solved && allStagesComplete,
        score,
        timeTaken: liveElapsedSeconds,
        difficulty,
      }).catch(() => {});

      const latestEntries = await getDailyActivityEntries().catch(() => []);
      if (latestEntries.length) {
        await maybeUnlockAchievements(latestEntries).catch(() => {});
      }

      await syncDailyActivity({ force: false }).catch(() => {});

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
  }, [
    grid,
    hintsUsed,
    persistLocalState,
    puzzle,
    maybeUnlockAchievements,
    refreshStageStatuses,
    recordDailyActivity,
    startedAt,
    syncDailyActivity,
    user?.id,
  ]);

  const syncProgress = useCallback(async () => {
    if (!puzzle || !user?.id) {
      return;
    }

    setSyncing(true);
    const liveElapsedSeconds = calculateElapsedSeconds(startedAt, Date.now());

    try {
      // Save current in-progress state and then flush queued activity.
      await saveProgressToApi({
        userId: user.id,
        puzzleDate: puzzle.date,
        puzzleType: puzzle.puzzleType,
        status: "in_progress",
        hintsUsed,
        score: 0,
        elapsedSeconds: liveElapsedSeconds,
      });

      const activitySync = await syncDailyActivity({ force: true }).catch(() => ({ synced: 0 }));

      setSubmitResult({
        solved: false,
        score: 0,
        message:
          activitySync.synced > 0
            ? `Progress synced. Heatmap synced ${activitySync.synced} day(s).`
            : "Progress synced to backend.",
        persisted: true,
      });

      const items = await loadHistoryFromApi(user.id);
      setHistory(items);
    } catch {
      // If backend fails, keep local snapshot and clear hard error for UX.
      await persistLocalState({
        puzzleDate: puzzle.date,
        puzzleType: puzzle.puzzleType,
        grid,
        hintsUsed,
        startedAt,
        elapsedSeconds: liveElapsedSeconds,
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
  }, [grid, hintsUsed, persistLocalState, puzzle, startedAt, syncDailyActivity, user?.id]);

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

  const completedStageCount = useMemo(
    () => stageStatuses.filter((stage) => stage.completed).length,
    [stageStatuses]
  );
  const totalStages = stageStatuses.length || DAILY_STAGES.length;
  const dailyRunCompleted = totalStages > 0 && completedStageCount === totalStages;

  const selectStage = useCallback(
    (nextStageType) => {
      const stage = stageStatuses.find((item) => item.puzzleType === nextStageType);

      if (!stage || !stage.unlocked) {
        return false;
      }

      setSelectedStageType(nextStageType);
      return true;
    },
    [stageStatuses]
  );

  return {
    loading,
    stageStatuses,
    stageEvaluations,
    selectedStageType,
    completedStageCount,
    totalStages,
    dailyRunCompleted,
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
    activityEntries,
    unsyncedActivityCount,
    validationState,
    latestAchievement,
    selectStage,
    updateCell,
    useHint,
    submitPuzzle,
    syncProgress,
    resetPuzzle,
    reloadPuzzle: loadPuzzle,
  };
}
