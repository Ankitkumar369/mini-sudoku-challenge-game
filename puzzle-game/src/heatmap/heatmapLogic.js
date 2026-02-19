const DAY_INDEX_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function ensureNoonLocal(date) {
  // Noon avoids DST midnight edge-cases while shifting days.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function toDateKeyLocal(dateValue) {
  const source = dateValue instanceof Date ? dateValue : new Date(dateValue);

  if (Number.isNaN(source.getTime())) {
    return "";
  }

  return `${source.getFullYear()}-${pad(source.getMonth() + 1)}-${pad(source.getDate())}`;
}

export function parseDateKeyLocal(dateKey) {
  const candidate = String(dateKey || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return null;
  }

  const [yearText, monthText, dayText] = candidate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function getDaysInYear(year) {
  if (!Number.isInteger(year)) {
    return 365;
  }

  return new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
}

export function createYearDateKeys(year) {
  const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
  const totalDays = getDaysInYear(safeYear);
  const days = [];
  let cursor = new Date(safeYear, 0, 1, 12, 0, 0, 0);

  for (let index = 0; index < totalDays; index += 1) {
    days.push(toDateKeyLocal(cursor));
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      12,
      0,
      0,
      0
    );
  }

  return days;
}

function toSafeActivityEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const date = toDateKeyLocal(entry.date);

  if (!date) {
    return null;
  }

  const score = Math.max(0, Math.floor(Number(entry.score) || 0));
  const timeTaken = Math.max(0, Math.floor(Number(entry.timeTaken) || 0));
  const difficulty = Math.max(0, Math.min(3, Math.floor(Number(entry.difficulty) || 0)));

  return {
    date,
    solved: Boolean(entry.solved),
    score,
    timeTaken,
    difficulty,
    synced: Boolean(entry.synced),
    updatedAt: Math.max(0, Math.floor(Number(entry.updatedAt) || 0)),
  };
}

export function createActivityMap(activityEntries) {
  if (!Array.isArray(activityEntries)) {
    return {};
  }

  return activityEntries.reduce((acc, entry) => {
    const safeEntry = toSafeActivityEntry(entry);

    if (!safeEntry) {
      return acc;
    }

    const previous = acc[safeEntry.date];

    if (!previous || safeEntry.updatedAt >= previous.updatedAt) {
      // Keep newest version if same date exists multiple times.
      acc[safeEntry.date] = safeEntry;
    }

    return acc;
  }, {});
}

export function getIntensityLevel(entry) {
  if (!entry || !entry.solved) {
    return 0;
  }

  if (entry.score >= 95 && entry.timeTaken <= 180 && entry.difficulty >= 2) {
    return 4;
  }

  if (entry.difficulty >= 3 || entry.score >= 85) {
    return 3;
  }

  if (entry.difficulty >= 2 || entry.score >= 65) {
    return 2;
  }

  return 1;
}

export function buildHeatmapColumns({ year, activityEntries }) {
  const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
  const yearDays = createYearDateKeys(safeYear);
  const activityMap = createActivityMap(activityEntries);
  const firstDay = parseDateKeyLocal(yearDays[0]) || new Date(safeYear, 0, 1, 12, 0, 0, 0);
  const leadingEmptyDays = firstDay.getDay();
  const cells = [];

  for (let index = 0; index < leadingEmptyDays; index += 1) {
    // Pad first week so columns align to weekday rows.
    cells.push(null);
  }

  for (const dateKey of yearDays) {
    const activity = activityMap[dateKey] || null;
    cells.push({
      date: dateKey,
      dayLabel: DAY_INDEX_LABELS[(parseDateKeyLocal(dateKey) || firstDay).getDay()],
      intensity: getIntensityLevel(activity),
      activity,
    });
  }

  while (cells.length % 7 !== 0) {
    // Pad trailing blanks to complete final week column.
    cells.push(null);
  }

  const columns = [];

  for (let offset = 0; offset < cells.length; offset += 7) {
    columns.push(cells.slice(offset, offset + 7));
  }

  return {
    year: safeYear,
    columns,
    totalDays: yearDays.length,
    leadingEmptyDays,
    trailingEmptyDays: cells.length - yearDays.length - leadingEmptyDays,
  };
}

export function calculateCurrentStreak(activityEntries, today = new Date()) {
  const activityMap = createActivityMap(activityEntries);
  let streak = 0;
  let cursor = ensureNoonLocal(today);

  while (true) {
    const key = toDateKeyLocal(cursor);
    const entry = activityMap[key];

    if (!entry || !entry.solved) {
      // First unsolved/missing day stops streak.
      return streak;
    }

    streak += 1;
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() - 1,
      12,
      0,
      0,
      0
    );
  }
}

export function calculateLongestStreak(activityEntries) {
  const activityMap = createActivityMap(activityEntries);
  const solvedDates = Object.values(activityMap)
    .filter((entry) => entry.solved)
    .map((entry) => entry.date)
    .sort((left, right) => left.localeCompare(right));

  let longest = 0;
  let current = 0;
  let previousDate = null;

  for (const dateKey of solvedDates) {
    const currentDate = parseDateKeyLocal(dateKey);

    if (!currentDate) {
      continue;
    }

    if (!previousDate) {
      current = 1;
      previousDate = currentDate;
      longest = Math.max(longest, current);
      continue;
    }

    const expected = new Date(
      previousDate.getFullYear(),
      previousDate.getMonth(),
      previousDate.getDate() + 1,
      12,
      0,
      0,
      0
    );

    if (toDateKeyLocal(expected) === dateKey) {
      // Consecutive solved day extends run.
      current += 1;
    } else {
      // Gap resets run length.
      current = 1;
    }

    previousDate = currentDate;
    longest = Math.max(longest, current);
  }

  return longest;
}
