// Imports: memoization hooks and heatmap logic helpers.
import { useMemo, useState } from "react";
import {
  buildHeatmapColumns,
  calculateCurrentStreak,
  calculateLongestStreak,
  createActivityMap,
  toDateKeyLocal,
} from "./heatmapLogic";

const INTENSITY_CLASS = {
  0: "bg-[rgba(232,230,230,0.18)]",
  1: "bg-[rgba(248,201,180,0.45)]",
  2: "bg-[rgba(235,91,44,0.58)]",
  3: "bg-[rgba(44,49,136,0.78)]",
  4: "bg-[rgba(44,49,136,0.98)]",
};

function formatTooltip(cell) {
  if (!cell?.date) {
    return "";
  }

  if (!cell.activity) {
    return `${cell.date}: Not played`;
  }

  const status = cell.activity.solved ? "Solved" : "Attempted";
  return `${cell.date}: ${status}, score ${cell.activity.score}, time ${cell.activity.timeTaken}s`;
}

function getSelectableYears(activityEntries) {
  // Always include current year even when there is no activity yet.
  const years = new Set([new Date().getFullYear()]);

  for (const entry of activityEntries) {
    const year = Number(String(entry?.date || "").slice(0, 4));

    if (Number.isInteger(year) && year > 2000 && year < 3000) {
      years.add(year);
    }
  }

  return Array.from(years).sort((left, right) => right - left);
}

export default function Heatmap({ activityEntries, unsyncedCount }) {
  const todayKey = toDateKeyLocal(new Date());
  const selectableYears = useMemo(() => getSelectableYears(activityEntries), [activityEntries]);
  const [selectedYear, setSelectedYear] = useState(() => selectableYears[0] || new Date().getFullYear());
  const activityMap = useMemo(() => createActivityMap(activityEntries), [activityEntries]);
  const heatmap = useMemo(
    () => buildHeatmapColumns({ year: selectedYear, activityEntries }),
    [selectedYear, activityEntries]
  );
  const currentStreak = useMemo(() => calculateCurrentStreak(activityEntries), [activityEntries]);
  const longestStreak = useMemo(() => calculateLongestStreak(activityEntries), [activityEntries]);
  const solvedDays = useMemo(
    () => Object.values(activityMap).filter((entry) => entry.solved).length,
    [activityMap]
  );

  return (
    <section className="space-y-4 rounded-2xl border border-[rgba(44,49,136,0.52)] bg-[rgba(24,31,88,0.45)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[rgba(248,201,180,0.88)]">
            Activity Heatmap
          </h3>
          <p className="text-xs text-[rgba(232,230,230,0.88)]">
            Current streak {currentStreak} days | Longest streak {longestStreak} days | Solved days{" "}
            {solvedDays}
          </p>
        </div>
        <label className="text-xs text-[rgba(232,230,230,0.88)]">
          Year{" "}
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="rounded-md border border-[rgba(248,201,180,0.35)] bg-[rgba(12,26,75,0.6)] px-2 py-1 text-[#e8e6e6] outline-none"
          >
            {selectableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        {/* GitHub-style weekly columns, 7 rows per weekday. */}
        <div className="inline-flex gap-1 rounded-xl border border-[rgba(44,49,136,0.4)] bg-[rgba(12,26,75,0.5)] p-3">
          {heatmap.columns.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1">
              {week.map((cell, dayIndex) => {
                if (!cell) {
                  return (
                    <span
                      key={`empty-${weekIndex}-${dayIndex}`}
                      className="h-3.5 w-3.5 rounded-[3px] bg-transparent"
                    />
                  );
                }

                return (
                  <span
                    key={cell.date}
                    title={formatTooltip(cell)}
                    className={`h-3.5 w-3.5 rounded-[3px] border transition-all duration-300 ${
                      cell.date === todayKey
                        ? "border-[rgba(248,201,180,0.9)] ring-1 ring-[rgba(248,201,180,0.5)]"
                        : "border-[rgba(255,255,255,0.08)]"
                    } ${
                      INTENSITY_CLASS[cell.intensity]
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[rgba(232,230,230,0.88)]">
        {/* Intensity legend from no activity (0) to best completion (4). */}
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={`legend-${level}`}
            className={`h-3.5 w-3.5 rounded-[3px] border border-[rgba(255,255,255,0.08)] ${INTENSITY_CLASS[level]}`}
          />
        ))}
        <span>More</span>
        {/* Offline queue count means local solved days are waiting for server sync. */}
        {unsyncedCount > 0 ? (
          <span className="rounded-full border border-[rgba(235,91,44,0.4)] bg-[rgba(235,91,44,0.16)] px-2 py-0.5 text-[rgba(248,201,180,0.95)]">
            Offline queue {unsyncedCount}
          </span>
        ) : (
          <span className="rounded-full border border-[rgba(44,49,136,0.65)] bg-[rgba(44,49,136,0.28)] px-2 py-0.5">
            Synced
          </span>
        )}
      </div>
    </section>
  );
}
