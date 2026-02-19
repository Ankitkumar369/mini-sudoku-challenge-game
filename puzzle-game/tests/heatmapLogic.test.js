import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHeatmapColumns,
  calculateCurrentStreak,
  calculateLongestStreak,
  createYearDateKeys,
  getDaysInYear,
  toDateKeyLocal,
} from "../src/heatmap/heatmapLogic.js";

test("getDaysInYear and createYearDateKeys handle leap year correctly", () => {
  assert.equal(getDaysInYear(2024), 366);
  assert.equal(getDaysInYear(2025), 365);

  const leapDays = createYearDateKeys(2024);
  assert.equal(leapDays.length, 366);
  assert.equal(leapDays[0], "2024-01-01");
  assert.equal(leapDays[59], "2024-02-29");
  assert.equal(leapDays[365], "2024-12-31");
});

test("buildHeatmapColumns builds 7-row weekly columns and preserves total day count", () => {
  const heatmap = buildHeatmapColumns({
    year: 2026,
    activityEntries: [
      { date: "2026-02-11", solved: true, score: 90, timeTaken: 100, difficulty: 2, synced: true },
    ],
  });

  assert.equal(heatmap.totalDays, 365);
  assert.ok(heatmap.columns.length >= 52);
  assert.ok(heatmap.columns.every((column) => column.length === 7));

  const cells = heatmap.columns.flat().filter(Boolean);
  assert.equal(cells.length, 365);

  const febEleven = cells.find((cell) => cell.date === "2026-02-11");
  assert.ok(febEleven);
  assert.ok(febEleven.intensity >= 1);
});

test("calculateCurrentStreak resets when today is unsolved and counts consecutive solved days", () => {
  const entries = [
    { date: "2026-02-09", solved: true, score: 80, timeTaken: 180, difficulty: 2, synced: true },
    { date: "2026-02-10", solved: true, score: 88, timeTaken: 150, difficulty: 2, synced: true },
    { date: "2026-02-11", solved: true, score: 95, timeTaken: 120, difficulty: 3, synced: true },
  ];

  assert.equal(calculateCurrentStreak(entries, new Date(2026, 1, 11, 9, 0, 0, 0)), 3);
  assert.equal(calculateCurrentStreak(entries, new Date(2026, 1, 12, 9, 0, 0, 0)), 0);
});

test("calculateLongestStreak computes best solved run", () => {
  const entries = [
    { date: "2026-02-01", solved: true, score: 70, timeTaken: 220, difficulty: 1, synced: true },
    { date: "2026-02-02", solved: true, score: 72, timeTaken: 210, difficulty: 1, synced: true },
    { date: "2026-02-04", solved: true, score: 92, timeTaken: 90, difficulty: 3, synced: true },
    { date: "2026-02-05", solved: true, score: 94, timeTaken: 85, difficulty: 3, synced: true },
    { date: "2026-02-06", solved: true, score: 96, timeTaken: 75, difficulty: 3, synced: true },
  ];

  assert.equal(calculateLongestStreak(entries), 3);
});

test("toDateKeyLocal uses local calendar date", () => {
  const key = toDateKeyLocal(new Date(2026, 1, 11, 23, 59, 0, 0));
  assert.equal(key, "2026-02-11");
});
