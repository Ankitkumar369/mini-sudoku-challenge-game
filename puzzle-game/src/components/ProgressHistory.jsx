import { formatDuration } from "../lib/formatters";

export default function ProgressHistory({ history }) {
  if (!history.length) {
    return (
      <p className="text-sm text-[rgba(232,230,230,0.7)]">
        No synced progress found yet. Use Save Progress after login.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <div
          key={`${entry.puzzleDate}-${entry.updatedAt || "no-time"}`}
          className="flex items-center justify-between rounded-lg border border-[rgba(44,49,136,0.5)] bg-[rgba(24,31,88,0.55)] px-3 py-2 text-xs"
        >
          <span>{entry.puzzleDate}</span>
          <span className="uppercase tracking-wide text-[rgba(248,201,180,0.9)]">{entry.status}</span>
          <span>Score {entry.score}</span>
          <span>Hints {entry.hintsUsed}</span>
          <span>Time {formatDuration(entry.elapsedSeconds || 0)}</span>
        </div>
      ))}
    </div>
  );
}
