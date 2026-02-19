// Imports: memo hook and local date key utility used for unlock calendar.
import { useMemo } from "react";
import { toDateKeyLocal } from "../heatmap/heatmapLogic";

function createDateWindow(todayDateKey, previousDays = 7, nextDays = 7) {
  const fallback = toDateKeyLocal(new Date());
  const safeDateKey = /^\d{4}-\d{2}-\d{2}$/.test(todayDateKey) ? todayDateKey : fallback;
  const center = new Date(`${safeDateKey}T12:00:00`);
  const list = [];

  for (let offset = previousDays; offset >= 1; offset -= 1) {
    const date = new Date(
      center.getFullYear(),
      center.getMonth(),
      center.getDate() - offset,
      12,
      0,
      0,
      0
    );
    list.push(toDateKeyLocal(date));
  }

  list.push(safeDateKey);

  for (let offset = 1; offset <= nextDays; offset += 1) {
    const date = new Date(
      center.getFullYear(),
      center.getMonth(),
      center.getDate() + offset,
      12,
      0,
      0,
      0
    );
    list.push(toDateKeyLocal(date));
  }

  return list;
}

export default function DailyUnlockPanel({ todayDateKey, activityEntries }) {
  const safeTodayDateKey = useMemo(() => {
    return /^\d{4}-\d{2}-\d{2}$/.test(todayDateKey) ? todayDateKey : toDateKeyLocal(new Date());
  }, [todayDateKey]);

  const activityMap = useMemo(() => {
    // Fast lookup for solved status by date.
    return activityEntries.reduce((acc, entry) => {
      acc[entry.date] = entry;
      return acc;
    }, {});
  }, [activityEntries]);

  const dates = useMemo(() => createDateWindow(safeTodayDateKey), [safeTodayDateKey]);
  const nextDateKey = useMemo(() => {
    const base = new Date(`${safeTodayDateKey}T12:00:00`);
    return toDateKeyLocal(
      new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 12, 0, 0, 0)
    );
  }, [safeTodayDateKey]);
  const todayCompleted = Boolean(activityMap[safeTodayDateKey]?.solved);

  return (
    <section className="space-y-3 rounded-2xl border border-[rgba(44,49,136,0.52)] bg-[rgba(24,31,88,0.45)] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[rgba(248,201,180,0.88)]">
        Daily Unlock
      </h3>
      <p className="text-xs text-[rgba(232,230,230,0.86)]">
        Only today is playable. Next day unlocks only after completing today.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {dates.map((dateKey) => {
          const entry = activityMap[dateKey];
          const isToday = dateKey === safeTodayDateKey;
          const isNextDay = dateKey === nextDateKey;
          const solved = Boolean(entry?.solved);
          // Business rule:
          // - today playable
          // - next day unlocks only after today is completed
          // - all other days stay locked (except already completed days)
          const unlocked = isToday || solved || (todayCompleted && isNextDay);
          const label = solved ? "Completed" : unlocked ? "Unlocked" : "Locked";
          const className = solved
            ? "border-[rgba(44,49,136,0.75)] bg-[rgba(44,49,136,0.32)] text-[#e8e6e6]"
            : unlocked
            ? "border-[rgba(235,91,44,0.6)] bg-[rgba(235,91,44,0.2)] text-[#f8c9b4]"
            : "border-[rgba(232,230,230,0.25)] bg-[rgba(12,26,75,0.5)] text-[rgba(232,230,230,0.75)]";

          return (
            <div key={dateKey} className={`rounded-lg border px-3 py-2 ${className}`}>
              <p>{dateKey}</p>
              <p className="mt-1 uppercase tracking-wide">{label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
