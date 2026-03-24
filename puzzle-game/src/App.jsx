import { useCallback, useMemo } from "react";
import { useAuth } from "./auth/useAuth";
import { useDailyPuzzle } from "./game/useDailyPuzzle";
import { GRID_SIZE } from "../shared/dailyPuzzle";
import { getClientSetupWarnings, isFirebaseConfigured } from "./lib/env";
import { formatDuration } from "./lib/formatters";
import Heatmap from "./heatmap/Heatmap";
import { calculateCurrentStreak, toDateKeyLocal } from "./heatmap/heatmapLogic";
import StatusBadge from "./components/StatusBadge";
import AuthError from "./components/AuthError";
import PuzzleGrid from "./components/PuzzleGrid";

export default function App() {
  const {
    user,
    loading,
    error,
    backendStatus,
    signInAsGuest,
    signInWithGoogle,
    signInWithTruecaller,
    signOut,
    clearError,
    checkBackendStatus,
  } = useAuth();

  const {
    loading: puzzleLoading,
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
    error: puzzleError,
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
    reloadPuzzle,
  } = useDailyPuzzle(user);

  const setupWarnings = useMemo(() => getClientSetupWarnings(), []);
  const currentStreak = useMemo(() => calculateCurrentStreak(activityEntries), [activityEntries]);
  const hintLimit = puzzle?.hintLimit ?? 0;
  const hintLimitReached = hintLimit > 0 && hintsUsed >= hintLimit;
  const puzzleLabel = puzzle?.puzzleTitle || "Daily Puzzle";
  const puzzleRules = puzzle?.rules || [];
  const currentStage = stageStatuses.find((stage) => stage.puzzleType === selectedStageType) || null;
  const violationCount =
    Number(validationState?.duplicateCount || 0) +
    Number(validationState?.clueViolationCount || 0) +
    Number(validationState?.givenMismatchCount || 0);

  const resetCountdown = useMemo(() => {
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);
    const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }, []);

  const backendErrorMessage =
    backendStatus === "degraded"
      ? "DB error: Database authentication failed. Check DATABASE_URL username/password."
      : backendStatus === "offline"
      ? "API is unreachable right now. You can continue with local gameplay."
      : "";

  const isOnlineLabel = backendStatus === "offline" ? "Offline" : "Online";

  const activityMap = useMemo(() => {
    return activityEntries.reduce((acc, entry) => {
      acc[entry.date] = entry;
      return acc;
    }, {});
  }, [activityEntries]);

  const recentDates = useMemo(() => {
    const anchor = puzzle?.date ? new Date(`${puzzle.date}T12:00:00`) : new Date();
    return Array.from({ length: 8 }, (_, index) => {
      const date = new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        anchor.getDate() - index,
        12,
        0,
        0,
        0
      );
      return toDateKeyLocal(date);
    });
  }, [puzzle]);

  const completedRuns = useMemo(
    () => history.filter((entry) => entry.status === "completed"),
    [history]
  );

  const leaderboardRows = useMemo(() => {
    return [...completedRuns]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return (left.elapsedSeconds || 0) - (right.elapsedSeconds || 0);
      })
      .slice(0, 5);
  }, [completedRuns]);

  const milestoneItems = useMemo(() => {
    return [
      {
        label: "Current Streak",
        value: `${currentStreak} day(s)`,
        unlocked: currentStreak > 0,
      },
      {
        label: "Best Score",
        value: String(summary.bestScore || 0),
        unlocked: summary.bestScore > 0,
      },
      {
        label: "Completed Runs",
        value: `${summary.completedCount}`,
        unlocked: summary.completedCount > 0,
      },
      {
        label: "Daily Run",
        value: dailyRunCompleted ? "Completed" : "In Progress",
        unlocked: dailyRunCompleted,
      },
    ];
  }, [currentStreak, dailyRunCompleted, summary.bestScore, summary.completedCount]);

  const handleLogout = useCallback(async () => {
    // Try one final sync on logout to satisfy batch-or-logout sync policy.
    await syncProgress().catch(() => {});
    await signOut();
  }, [signOut, syncProgress]);

  return (
    <main
      className="min-h-screen bg-[linear-gradient(180deg,#e6ecf8_0%,#f0ecf6_52%,#ece8f5_100%)] px-3 py-6 text-[#1f2340] sm:px-5 sm:py-8"
    >
      <section
        className="mx-auto flex w-full max-w-5xl flex-col gap-5 rounded-3xl border border-[rgba(166,188,255,0.48)] bg-[rgba(244,246,253,0.93)] p-4 shadow-lg sm:gap-6 sm:p-6"
      >
        <header className="space-y-4">
          <div className="rounded-3xl border border-[rgba(166,188,255,0.4)] bg-[rgba(243,236,249,0.98)] p-4 text-[#1f1f2e] shadow-lg sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold leading-tight text-[#120d8f] sm:text-4xl">
                  Mini Sudoku Challenge Game
                </h1>
                <p className="mt-2 text-base text-[#2a2a40]">
                  Sharpen your logic daily with high-impact puzzles, streak rewards, and smart progress.
                </p>
                <p className="text-base text-[#2a2a40]">Next daily reset in {resetCountdown} (local time).</p>
              </div>
              <span className="rounded-full border border-[rgba(136,178,255,0.6)] bg-[rgba(203,228,255,0.75)] px-4 py-1.5 text-sm font-semibold text-[#141821]">
                {isOnlineLabel}
              </span>
            </div>
          </div>

          {!user ? (
            <div className="space-y-4 rounded-2xl border border-[rgba(121,150,225,0.66)] bg-[linear-gradient(160deg,#ece7f6_0%,#e4edff_100%)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={backendStatus} />
                <button
                  type="button"
                  className="rounded-2xl bg-[#edeaf6] px-5 py-2 text-base font-semibold text-[#100f9a] transition hover:bg-[#ffffff] disabled:opacity-70"
                  onClick={checkBackendStatus}
                  disabled={loading}
                >
                  Check API
                </button>
              </div>
              {backendErrorMessage ? <p className="text-sm text-[#3d456f]">{backendErrorMessage}</p> : null}
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className="rounded-2xl bg-[rgba(92,120,255,0.76)] px-4 py-3 text-xl font-semibold text-[#f7faff] transition hover:bg-[rgba(108,134,255,0.95)] disabled:opacity-70"
                  onClick={signInAsGuest}
                  disabled={loading}
                >
                  {loading ? "Please wait..." : "Continue as Guest"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[rgba(92,120,255,0.76)] px-4 py-3 text-xl font-semibold text-[#f7faff] transition hover:bg-[rgba(108,134,255,0.95)] disabled:opacity-70"
                  onClick={signInWithGoogle}
                  disabled={loading || !isFirebaseConfigured}
                >
                  {loading ? "Please wait..." : "Continue with Google"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-[rgba(190,204,236,0.84)] px-4 py-3 text-xl font-semibold text-[#f7faff] transition hover:bg-[rgba(196,210,242,0.95)] disabled:cursor-not-allowed disabled:opacity-80"
                  onClick={signInWithTruecaller}
                  disabled
                >
                  Continue with Truecaller
                </button>
              </div>
            </div>
          ) : null}
        </header>

        <AuthError message={error} onClear={clearError} />
        <AuthError message={puzzleError} onClear={reloadPuzzle} />
        {setupWarnings.length && !user ? (
          <div className="rounded-xl border border-[rgba(215,99,72,0.45)] bg-[rgba(244,201,188,0.62)] p-3 text-xs text-[#5f2a1e]">
            {setupWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {user ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(154,174,225,0.7)] bg-[#f6f9ff] p-3">
              <p className="text-sm font-semibold text-[#1f2340]">
                {user.name || "Guest Player"} | {puzzle?.date || toDateKeyLocal(new Date())}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[rgba(96,120,199,0.6)] bg-[rgba(224,233,252,0.95)] px-4 py-2 text-sm font-semibold text-[#1a208f] transition hover:bg-white disabled:opacity-70"
                  onClick={syncProgress}
                  disabled={syncing || puzzleLoading || submitting}
                >
                  {syncing ? "Syncing..." : "Force Sync"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[rgba(96,120,199,0.6)] bg-[rgba(224,233,252,0.95)] px-4 py-2 text-sm font-semibold text-[#1a208f] transition hover:bg-white disabled:opacity-70"
                  onClick={handleLogout}
                  disabled={loading || syncing || submitting}
                >
                  Logout
                </button>
              </div>
            </div>

            <section className="space-y-3 rounded-2xl border border-[rgba(144,170,230,0.5)] bg-[#f7f9ff] p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#1a1f8b]">
                  Daily Run Progress
                </h3>
                <p className="text-sm font-semibold text-[#1f2340]">
                  {completedStageCount}/{totalStages} stages
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-[rgba(144,170,230,0.6)] bg-[rgba(197,213,245,0.68)]">
                <div
                  className={`h-full transition-all duration-500 ${
                    dailyRunCompleted ? "bg-[rgba(84,122,255,0.9)]" : "bg-[rgba(84,122,255,0.75)]"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((completedStageCount / Math.max(1, totalStages)) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-xs text-[rgba(43,49,85,0.92)]">
                Complete each unlocked stage in order. Next stage unlocks only after current stage is solved.
              </p>
              <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
                {stageStatuses.map((stage) => {
                  const isActive = stage.puzzleType === selectedStageType;
                  const statusLabel = stage.completed ? "Completed" : stage.unlocked ? "Unlocked" : "Locked";

                  return (
                    <button
                      key={stage.puzzleType}
                      type="button"
                      onClick={() => selectStage(stage.puzzleType)}
                      disabled={!stage.unlocked || puzzleLoading}
                      className={`min-w-[200px] rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        stage.completed
                          ? "border-[rgba(86,118,235,0.65)] bg-[rgba(86,118,235,0.16)]"
                          : stage.unlocked
                          ? "border-[rgba(86,118,235,0.65)] bg-[rgba(86,118,235,0.08)]"
                          : "border-[rgba(167,184,219,0.8)] bg-[rgba(224,232,247,0.7)]"
                      } ${isActive ? "ring-2 ring-[rgba(86,118,235,0.85)]" : ""}`}
                    >
                      <p className="text-xs text-[rgba(57,67,108,0.95)]">Stage {stage.stageNumber}</p>
                      <p className="mt-1 text-base font-semibold text-[#1f2340]">{stage.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-[rgba(57,67,108,0.9)]">
                        {statusLabel}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <section className="space-y-4 rounded-2xl border border-[rgba(144,170,230,0.62)] bg-[#f7f9ff] p-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#5b66c0]">Daily Puzzle</p>
                    <h3 className="text-base font-semibold text-[#141a8a] sm:text-lg">
                      {puzzleLabel}: fill every row and column with numbers 1 to {GRID_SIZE}
                    </h3>
                    {currentStage ? (
                      <p className="mt-1 text-xs text-[#2f3768]">
                        Stage {currentStage.stageNumber} of {totalStages}
                      </p>
                    ) : null}
                  </div>
                  {puzzleRules.length ? (
                    <div className="rounded-xl border border-[rgba(154,174,225,0.62)] bg-[rgba(228,236,252,0.8)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#141a8a]">Rules</p>
                      <ul className="mt-2 space-y-1 text-xs text-[#2f3768]">
                        {puzzleRules.map((rule) => (
                          <li key={rule}>- {rule}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {puzzleLoading ? (
                  <p className="text-sm text-[#2f3768]">Loading puzzle...</p>
                ) : (
                  <div className="w-full max-w-md rounded-2xl border border-[rgba(154,174,225,0.62)] bg-white p-3">
                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-[#2f3768] sm:grid-cols-4">
                      <p>Date: {puzzle?.date || "-"}</p>
                      <p>Type: {puzzle?.puzzleType || "-"}</p>
                      <p>Time: {formatDuration(elapsedSeconds)}</p>
                      <p>
                        Filled: {cellStats.filledEditable}/{cellStats.totalEditable}
                      </p>
                    </div>
                    <PuzzleGrid
                      puzzle={puzzle}
                      grid={grid}
                      onUpdate={updateCell}
                      validationState={validationState}
                    />
                    {violationCount > 0 ? (
                      <p className="mt-3 rounded-lg border border-[rgba(255,98,124,0.46)] bg-[rgba(255,98,124,0.16)] px-3 py-2 text-xs text-[#8f2134]">
                        Active rule issues: {violationCount}. Fix highlighted cells/clues and submit again.
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[rgba(116,140,210,0.75)] px-3 py-2 text-sm text-[#1f2340] hover:bg-[rgba(224,233,252,0.95)] disabled:opacity-60"
                    onClick={useHint}
                    disabled={puzzleLoading || submitting || hintLimitReached}
                  >
                    Hint ({hintsUsed}/{hintLimit || 0})
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[#4a57dd] px-3 py-2 text-sm font-semibold text-[#f3f6ff] hover:bg-[#3f49bf] disabled:opacity-60"
                    onClick={submitPuzzle}
                    disabled={puzzleLoading || submitting}
                  >
                    {submitting ? "Submitting..." : "Validate"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[rgba(116,140,210,0.75)] px-3 py-2 text-sm text-[#1f2340] hover:bg-[rgba(224,233,252,0.95)] disabled:opacity-60"
                    onClick={resetPuzzle}
                    disabled={puzzleLoading || submitting}
                  >
                    Clear
                  </button>
                </div>

                {submitResult ? (
                  <div className="rounded-xl border border-[rgba(86,118,235,0.58)] bg-[rgba(86,118,235,0.14)] p-3 text-sm text-[#1a208f]">
                    <p>{submitResult.message}</p>
                    <p className="mt-1 text-xs opacity-90">
                      Score: {submitResult.score} | Persisted: {submitResult.persisted ? "yes" : "no"}
                    </p>
                  </div>
                ) : null}
              </section>

              <aside className="space-y-3 rounded-2xl border border-[rgba(154,174,225,0.65)] bg-[#f7f9ff] p-4">
                <h3 className="text-3xl font-semibold text-[#141a8a]">Progress</h3>
                <p className="text-sm text-[#2f3768]">
                  Current streak: <span className="font-semibold text-[#1f2340]">{currentStreak} day(s)</span>
                </p>
                <p className="rounded-full border border-[rgba(150,185,230,0.7)] bg-[rgba(201,224,250,0.62)] px-3 py-1 text-xs font-semibold text-[#21315c]">
                  {backendStatus === "offline" ? "Offline session active" : "Online Sync Ready"}
                </p>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#141a8a]">Stage Evaluation</h4>
                  {stageEvaluations.map((stage) => (
                    <div
                      key={`eval-${stage.puzzleType}`}
                      className="rounded-lg border border-[rgba(154,174,225,0.65)] bg-white px-3 py-2 text-xs"
                    >
                      <p className="font-semibold text-[#1f2340]">
                        Stage {stage.stageNumber}: {stage.title}
                      </p>
                      {stage.completed ? (
                        <p className="mt-1 text-[#2f3768]">
                          Completed in {formatDuration(stage.elapsedSeconds)} | Score {stage.score} | Hints {stage.hintsUsed}
                        </p>
                      ) : (
                        <p className="mt-1 text-[#4a5179]">{stage.unlocked ? "Unlocked" : "Locked"}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[#141a8a]">Recent Days</h4>
                  {recentDates.map((dateKey) => {
                    const entry = activityMap[dateKey];
                    const label = entry?.solved ? "Completed" : "Locked";

                    return (
                      <div
                        key={dateKey}
                        className="flex items-center justify-between rounded-lg border border-[rgba(154,174,225,0.65)] bg-white px-3 py-1.5 text-xs"
                      >
                        <span className="text-[#2f3768]">{dateKey}</span>
                        <span className={entry?.solved ? "font-semibold text-[#1f5a2b]" : "text-[#4a5179]"}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>

            <section className="space-y-4">
              <div className="w-full">
                <Heatmap activityEntries={activityEntries} unsyncedCount={unsyncedActivityCount} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[rgba(121,150,225,0.7)] bg-[linear-gradient(140deg,#f8fbff_0%,#ecf2ff_48%,#e4edff_100%)] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[#111886]">Milestones</h3>
                    <span className="rounded-full border border-[rgba(110,139,221,0.55)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1d2b8f]">
                      Progress Badges
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[#3d456f]">
                    {latestAchievement
                      ? `Latest unlock: ${latestAchievement}`
                      : "No badges yet. Keep your streak alive."}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {milestoneItems.map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-xl border px-3 py-2 ${
                          item.unlocked
                            ? "border-[rgba(77,118,225,0.65)] bg-[rgba(104,130,237,0.14)]"
                            : "border-[rgba(163,178,214,0.7)] bg-white"
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-[0.08em] text-[#4a5684]">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-[#1f2340]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(121,150,225,0.7)] bg-[linear-gradient(155deg,#f7faff_0%,#eff4ff_52%,#e8f0ff_100%)] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[#111886]">Daily Leaderboard Preview</h3>
                    <span className="rounded-full border border-[rgba(110,139,221,0.55)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1d2b8f]">
                      Top 5 Runs
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-[rgba(150,171,224,0.65)] bg-white px-3 py-2">
                      <p className="text-[#53608f]">Best Score</p>
                      <p className="mt-1 text-base font-semibold text-[#1f2340]">{summary.bestScore || 0}</p>
                    </div>
                    <div className="rounded-xl border border-[rgba(150,171,224,0.65)] bg-white px-3 py-2">
                      <p className="text-[#53608f]">Completed</p>
                      <p className="mt-1 text-base font-semibold text-[#1f2340]">{summary.completedCount}</p>
                    </div>
                  </div>

                  {leaderboardRows.length ? (
                    <div className="mt-3 space-y-2">
                      {leaderboardRows.map((entry, index) => (
                        <div
                          key={`${entry.puzzleDate}-${entry.updatedAt || index}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[rgba(150,171,224,0.65)] bg-white px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(91,114,223,0.16)] font-semibold text-[#1b2493]">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-[#1f2340]">{entry.puzzleDate}</p>
                              <p className="text-[#5b678f]">{entry.puzzleType || "daily-stage"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-[#1f2340]">Score {entry.score}</p>
                            <p className="text-[#5b678f]">{formatDuration(entry.elapsedSeconds || 0)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#3d456f]">
                      No synced scores yet. Complete and sync runs to populate leaderboard.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}





