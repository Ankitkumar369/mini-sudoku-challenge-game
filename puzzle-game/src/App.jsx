import { useMemo } from "react";
import { useAuth } from "./auth/useAuth";
import { useDailyPuzzle } from "./game/useDailyPuzzle";
import { GRID_SIZE } from "../shared/dailyPuzzle";
import { getClientSetupWarnings, isFirebaseConfigured } from "./lib/env";

function StatusBadge({ status }) {
  const className =
    status === "healthy"
      ? "bg-emerald-500/20 text-emerald-200"
      : status === "degraded"
      ? "bg-sky-500/20 text-sky-200"
      : status === "offline"
      ? "bg-amber-500/20 text-amber-200"
      : "bg-slate-500/20 text-slate-200";

  const label =
    status === "healthy"
      ? "Backend connected"
      : status === "degraded"
      ? "API online, DB not connected"
      : status === "offline"
      ? "Backend unavailable"
      : "Backend not checked";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function AuthError({ message, onClear }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-100">
      <div className="flex items-start justify-between gap-4">
        <p>{message}</p>
        <button
          type="button"
          className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
          onClick={onClear}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function PuzzleGrid({ puzzle, grid, onUpdate }) {
  if (!puzzle) {
    return null;
  }

  return (
    <div className="grid w-full max-w-md grid-cols-4 gap-2">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isGiven = puzzle.givens[rowIndex][colIndex] !== null;
          const value = cell === null ? "" : String(cell);

          return (
            <input
              key={`${rowIndex}-${colIndex}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={value}
              onChange={(event) => onUpdate(rowIndex, colIndex, event.target.value)}
              disabled={isGiven}
              className={`h-14 rounded-xl border text-center text-xl font-semibold outline-none transition ${
                isGiven
                  ? "cursor-not-allowed border-slate-600 bg-slate-800 text-slate-100"
                  : "border-slate-500 bg-slate-900 text-cyan-200 focus:border-cyan-300"
              }`}
            />
          );
        })
      )}
    </div>
  );
}

function ProgressHistory({ history }) {
  if (!history.length) {
    return (
      <p className="text-sm text-slate-400">
        No synced progress found yet. Use Save Progress after login.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <div
          key={`${entry.puzzleDate}-${entry.updatedAt || "no-time"}`}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs"
        >
          <span>{entry.puzzleDate}</span>
          <span className="uppercase tracking-wide text-slate-300">{entry.status}</span>
          <span>Score {entry.score}</span>
          <span>Hints {entry.hintsUsed}</span>
          <span>Time {formatDuration(entry.elapsedSeconds || 0)}</span>
        </div>
      ))}
    </div>
  );
}

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300">
            Capstone Project
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">Daily Puzzle Logic Game</h1>
          <p className="text-sm text-slate-300">{subtitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={backendStatus} />
            <button
              type="button"
              className="rounded-lg border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
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
          <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            {setupWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {!user ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-70"
              onClick={signInAsGuest}
              disabled={loading}
            >
              {loading ? "Please wait..." : "Continue as Guest"}
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-70"
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
              className="rounded-xl border border-slate-300/30 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:opacity-70"
              onClick={signInWithTruecaller}
              disabled={loading}
            >
              {loading ? "Starting..." : "Continue with Truecaller"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Player</p>
              <h2 className="mt-1 text-2xl font-semibold">{user.name || "Puzzle Player"}</h2>
              <p className="text-sm text-slate-300">{user.email || user.phone || "No email available"}</p>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>User ID: {user.id}</span>
              <span>Provider: {user.provider}</span>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
              onClick={signOut}
              disabled={loading}
            >
              Sign out
            </button>
          </div>
        )}

        <section className="space-y-4 rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Daily Puzzle</p>
              <h3 className="text-lg font-semibold text-cyan-100">
                Fill every row and column with numbers 1 to {GRID_SIZE}
              </h3>
            </div>
            <div className="text-right text-xs text-slate-300">
              <p>Date: {puzzle?.date || "-"}</p>
              <p>Time: {formatDuration(elapsedSeconds)}</p>
              <p>
                Filled: {cellStats.filledEditable}/{cellStats.totalEditable}
              </p>
            </div>
          </div>

          {puzzleLoading ? (
            <p className="text-sm text-slate-300">Loading puzzle...</p>
          ) : (
            <PuzzleGrid puzzle={puzzle} grid={grid} onUpdate={updateCell} />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-cyan-300/30 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-60"
              onClick={useHint}
              disabled={puzzleLoading || submitting}
            >
              Use Hint ({hintsUsed})
            </button>
            <button
              type="button"
              className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-200 disabled:opacity-60"
              onClick={submitPuzzle}
              disabled={puzzleLoading || submitting}
            >
              {submitting ? "Submitting..." : "Submit Puzzle"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
              onClick={resetPuzzle}
              disabled={puzzleLoading || submitting}
            >
              Reset
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
              onClick={reloadPuzzle}
              disabled={puzzleLoading || submitting}
            >
              Reload Puzzle
            </button>
            <button
              type="button"
              className="rounded-lg border border-emerald-300/30 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60"
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
                  ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-300/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              <p>{submitResult.message}</p>
              <p className="mt-1 text-xs opacity-80">
                Score: {submitResult.score} | Persisted: {submitResult.persisted ? "yes" : "no"}
              </p>
            </div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            Synced Progress
          </h3>
          <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
              Completed: {summary.completedCount}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
              Attempted: {summary.attemptedCount}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
              Best Score: {summary.bestScore}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
              Avg Time: {formatDuration(summary.averageTimeSeconds)}
            </div>
          </div>
          <ProgressHistory history={history} />
        </section>
      </section>
    </main>
  );
}
