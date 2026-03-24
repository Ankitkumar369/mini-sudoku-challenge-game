// Imports: app hooks, shared constants, UI sections, and presentational components.
import { useMemo } from "react";
import { useAuth } from "./auth/useAuth";
import { useDailyPuzzle } from "./game/useDailyPuzzle";
import { GRID_SIZE } from "../shared/dailyPuzzle";
import { getClientSetupWarnings, isFirebaseConfigured } from "./lib/env";
import { formatDuration } from "./lib/formatters";
import Heatmap from "./heatmap/Heatmap";
import DailyUnlockPanel from "./unlock/DailyUnlockPanel";
import { calculateCurrentStreak } from "./heatmap/heatmapLogic";
import StatusBadge from "./components/StatusBadge";
import AuthError from "./components/AuthError";
import PuzzleGrid from "./components/PuzzleGrid";
import ProgressHistory from "./components/ProgressHistory";

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
    updateCell,
    useHint,
    submitPuzzle,
    syncProgress,
    resetPuzzle,
    reloadPuzzle,
  } = useDailyPuzzle(user);
  const setupWarnings = useMemo(() => getClientSetupWarnings(), []);

  const subtitle = useMemo(() => {
    if (!user) {
      return "Play as guest or sign in to sync your daily streak across devices.";
    }

    return `Signed in with ${user.provider}. Daily puzzle sync is enabled.`;
  }, [user]);

  const currentStreak = useMemo(() => calculateCurrentStreak(activityEntries), [activityEntries]);
  const hintLimit = puzzle?.hintLimit ?? 0;
  const hintLimitReached = hintLimit > 0 && hintsUsed >= hintLimit;
  const puzzleLabel = puzzle?.puzzleTitle || "Daily Puzzle";
  const puzzleRules = puzzle?.rules || [];
  const violationCount =
    Number(validationState?.duplicateCount || 0) +
    Number(validationState?.clueViolationCount || 0) +
    Number(validationState?.givenMismatchCount || 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#15357f_0%,#101a48_42%,#091335_100%)] px-3 py-6 text-[#f2f6ff] sm:px-5 sm:py-8">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 rounded-3xl border border-[rgba(125,160,255,0.22)] bg-[rgba(8,19,55,0.82)] p-4 shadow-2xl backdrop-blur sm:gap-6 sm:p-6">
        {/* Header: app branding + streak + backend status */}
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-[rgba(248,201,180,0.85)]">
            Capstone Project
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Mini Sudoku Challenge Game</h1>
          <p className="text-sm text-[rgba(232,230,230,0.88)]">{subtitle}</p>
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(235,91,44,0.6)] bg-[rgba(235,91,44,0.2)] px-3 py-1 text-xs font-semibold text-[#f8c9b4]">
            Streak {currentStreak} day{currentStreak === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={backendStatus} />
            <button
              type="button"
              className="rounded-lg border border-[rgba(248,201,180,0.35)] px-3 py-1 text-xs text-[#e8e6e6] hover:bg-[rgba(248,201,180,0.14)]"
              onClick={checkBackendStatus}
              disabled={loading}
            >
              Check API
            </button>
          </div>
        </header>

        <AuthError message={error} onClear={clearError} />
        <AuthError message={puzzleError} onClear={reloadPuzzle} />
        {setupWarnings.length ? (
          <div className="rounded-xl border border-[rgba(235,91,44,0.48)] bg-[rgba(235,91,44,0.16)] p-3 text-xs text-[#f8c9b4]">
            {setupWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {/* Auth panel: choose guest/google/truecaller or show signed-in user details */}
        {!user ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              className="rounded-xl border border-[rgba(235,91,44,0.65)] bg-[rgba(235,91,44,0.2)] px-4 py-3 text-sm font-semibold text-[#f8c9b4] transition hover:bg-[rgba(235,91,44,0.28)] disabled:opacity-70"
              onClick={signInAsGuest}
              disabled={loading}
            >
              {loading ? "Please wait..." : "Continue as Guest"}
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#e8e6e6] px-4 py-3 text-sm font-semibold text-[#241f20] transition hover:bg-[#f8c9b4] disabled:opacity-70"
              onClick={signInWithGoogle}
              disabled={loading || !isFirebaseConfigured}
            >
              {loading
                ? "Please wait..."
                : isFirebaseConfigured
                ? "Continue with Google"
                : "Configure Firebase for Google"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[rgba(44,49,136,0.75)] bg-[rgba(44,49,136,0.3)] px-4 py-3 text-sm font-semibold text-[#e8e6e6] transition hover:bg-[rgba(44,49,136,0.5)] disabled:opacity-70"
              onClick={signInWithTruecaller}
              disabled={loading}
            >
              {loading ? "Starting..." : "Continue with Truecaller"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-[rgba(44,49,136,0.55)] bg-[rgba(24,31,88,0.55)] p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(248,201,180,0.8)]">Player</p>
              <h2 className="mt-1 text-2xl font-semibold">{user.name || "Puzzle Player"}</h2>
              <p className="text-sm text-[rgba(232,230,230,0.86)]">
                {user.email || user.phone || "No email available"}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm text-[rgba(232,230,230,0.88)]">
              <span>User ID: {user.id}</span>
              <span>Provider: {user.provider}</span>
            </div>
            <button
              type="button"
              className="rounded-lg border border-[rgba(248,201,180,0.35)] px-3 py-2 text-sm text-[#f8c9b4] hover:bg-[rgba(235,91,44,0.2)]"
              onClick={signOut}
              disabled={loading}
            >
              Sign out
            </button>
          </div>
        )}

        {/* Puzzle panel: board, timer, hints, submit, reset, save */}
        <section className="space-y-4 rounded-2xl border border-[rgba(88,124,214,0.64)] bg-[rgba(17,35,92,0.46)] p-4">
          <div className="space-y-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#f8c9b4]">Daily Puzzle</p>
              <h3 className="text-base font-semibold text-[#f2f6ff] sm:text-lg">
                {puzzleLabel}: fill every row and column with numbers 1 to {GRID_SIZE}
              </h3>
            </div>
            {puzzleRules.length ? (
              <div className="rounded-xl border border-[rgba(125,160,255,0.3)] bg-[rgba(7,19,56,0.62)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(182,206,255,0.95)]">
                  Rules
                </p>
                <ul className="mt-2 space-y-1 text-xs text-[rgba(230,238,255,0.9)]">
                  {puzzleRules.map((rule) => (
                    <li key={rule}>- {rule}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {puzzleLoading ? (
            <p className="text-sm text-[rgba(232,230,230,0.88)]">Loading puzzle...</p>
          ) : (
            <div className="w-full max-w-md rounded-2xl border border-[rgba(88,124,214,0.58)] bg-[rgba(7,19,56,0.72)] p-3">
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-[rgba(232,230,230,0.9)] sm:grid-cols-4">
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
                <p className="mt-3 rounded-lg border border-[rgba(255,98,124,0.56)] bg-[rgba(120,26,44,0.28)] px-3 py-2 text-xs text-[#ffd9e2]">
                  Active rule issues: {violationCount}. Fix highlighted cells/clues and submit again.
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[rgba(248,201,180,0.45)] px-3 py-2 text-sm text-[#f8c9b4] hover:bg-[rgba(248,201,180,0.14)] disabled:opacity-60"
              onClick={useHint}
              disabled={puzzleLoading || submitting || hintLimitReached}
            >
              Use Hint ({hintsUsed}/{hintLimit || 0})
            </button>
            <button
              type="button"
              className="rounded-lg bg-[#eb5b2c] px-3 py-2 text-sm font-semibold text-[#e8e6e6] hover:bg-[#d14c20] disabled:opacity-60"
              onClick={submitPuzzle}
              disabled={puzzleLoading || submitting}
            >
              {submitting ? "Submitting..." : "Submit Puzzle"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[rgba(232,230,230,0.35)] px-3 py-2 text-sm text-[#e8e6e6] hover:bg-[rgba(232,230,230,0.1)] disabled:opacity-60"
              onClick={resetPuzzle}
              disabled={puzzleLoading || submitting}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded-lg border border-[rgba(232,230,230,0.35)] px-3 py-2 text-sm text-[#e8e6e6] hover:bg-[rgba(232,230,230,0.1)] disabled:opacity-60"
              onClick={reloadPuzzle}
              disabled={puzzleLoading || submitting}
            >
              Reload Puzzle
            </button>
            <button
              type="button"
              className="rounded-lg border border-[rgba(44,49,136,0.75)] px-3 py-2 text-sm text-[#e8e6e6] hover:bg-[rgba(44,49,136,0.3)] disabled:opacity-60"
              onClick={syncProgress}
              disabled={!user || syncing || puzzleLoading || submitting}
            >
              {syncing ? "Saving..." : "Save Progress"}
            </button>
          </div>

          {submitResult ? (
            <div
              className={`rounded-xl border p-3 text-sm ${
                submitResult.solved
                  ? "animate-completion border-[rgba(44,49,136,0.75)] bg-[rgba(44,49,136,0.32)] text-[#e8e6e6]"
                  : "border-[rgba(235,91,44,0.56)] bg-[rgba(235,91,44,0.2)] text-[#f8c9b4]"
              }`}
            >
              <p>{submitResult.message}</p>
              <p className="mt-1 text-xs opacity-80">
                Score: {submitResult.score} | Persisted: {submitResult.persisted ? "yes" : "no"}
              </p>
            </div>
          ) : null}

          {latestAchievement ? (
            <div className="animate-achievement rounded-xl border border-[rgba(235,91,44,0.58)] bg-[rgba(235,91,44,0.2)] p-3 text-sm text-[#f8c9b4]">
              Achievement: {latestAchievement}
            </div>
          ) : null}
        </section>

        {/* Synced summary + last saved attempts from backend */}
        <section className="space-y-3 rounded-2xl border border-[rgba(44,49,136,0.52)] bg-[rgba(24,31,88,0.45)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[rgba(248,201,180,0.88)]">
            Synced Progress
          </h3>
          <div className="grid gap-2 text-xs text-[rgba(232,230,230,0.9)] sm:grid-cols-4">
            <div className="rounded-lg border border-[rgba(44,49,136,0.55)] bg-[rgba(12,26,75,0.5)] px-3 py-2">
              Completed: {summary.completedCount}
            </div>
            <div className="rounded-lg border border-[rgba(44,49,136,0.55)] bg-[rgba(12,26,75,0.5)] px-3 py-2">
              Attempted: {summary.attemptedCount}
            </div>
            <div className="rounded-lg border border-[rgba(44,49,136,0.55)] bg-[rgba(12,26,75,0.5)] px-3 py-2">
              Best Score: {summary.bestScore}
            </div>
            <div className="rounded-lg border border-[rgba(44,49,136,0.55)] bg-[rgba(12,26,75,0.5)] px-3 py-2">
              Avg Time: {formatDuration(summary.averageTimeSeconds)}
            </div>
          </div>
          <ProgressHistory history={history} />
        </section>

        {/* Retention view: year heatmap + unlock progression */}
        <Heatmap activityEntries={activityEntries} unsyncedCount={unsyncedActivityCount} />

        <DailyUnlockPanel todayDateKey={puzzle?.date || "-"} activityEntries={activityEntries} />
      </section>
    </main>
  );
}

