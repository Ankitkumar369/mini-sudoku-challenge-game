// Imports: low-level IndexedDB key-value operations used by app-level stores.
import { deleteValue, getValue, setValue } from "./indexedDb";

// IndexedDB key namespace for all local/offline records.
const SESSION_USER_KEY = "session.user";
const DAILY_PROGRESS_KEY = "progress.daily";
const DAILY_ACTIVITY_KEY = "progress.activity.daily";
const ACHIEVEMENTS_KEY = "progress.achievements";

function encodeGrid(grid) {
  if (!Array.isArray(grid) || grid.length === 0) {
    return "";
  }

  const rowCount = grid.length;
  const colCount = Array.isArray(grid[0]) ? grid[0].length : 0;

  if (colCount === 0) {
    return "";
  }

  let cells = "";

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const value = Number(grid[row]?.[col]);
      cells += Number.isInteger(value) && value > 0 ? String(value) : "0";
    }
  }

  return `${rowCount}x${colCount}:${cells}`;
}

function decodeGrid(encodedGrid) {
  const raw = String(encodedGrid || "").trim();

  if (!raw.includes(":")) {
    return null;
  }

  const [sizePart, cells] = raw.split(":");
  const [rowRaw, colRaw] = sizePart.split("x");
  const rowCount = Number(rowRaw);
  const colCount = Number(colRaw);

  if (!Number.isInteger(rowCount) || !Number.isInteger(colCount) || rowCount <= 0 || colCount <= 0) {
    return null;
  }

  if (cells.length !== rowCount * colCount) {
    return null;
  }

  const grid = [];
  let index = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const line = [];

    for (let col = 0; col < colCount; col += 1) {
      const digit = Number(cells[index]);
      line.push(Number.isInteger(digit) && digit > 0 ? digit : null);
      index += 1;
    }

    grid.push(line);
  }

  return grid;
}

export async function getSessionUser() {
  return (await getValue(SESSION_USER_KEY)) || null;
}

export async function setSessionUser(user) {
  return setValue(SESSION_USER_KEY, user);
}

export async function clearSessionUser() {
  return deleteValue(SESSION_USER_KEY);
}

export async function getDailyProgress() {
  return (await getValue(DAILY_PROGRESS_KEY)) || {};
}

export async function setDailyProgress(progress) {
  return setValue(DAILY_PROGRESS_KEY, progress);
}

export async function getPuzzleProgress(dateKey) {
  const progress = await getDailyProgress();
  const entry = progress[dateKey] || null;

  if (!entry) {
    return null;
  }

  // Backward compatible: keep old `grid` if present, otherwise decode compact representation.
  if (Array.isArray(entry.grid)) {
    return entry;
  }

  const decodedGrid = decodeGrid(entry.gridEncoded);
  if (!decodedGrid) {
    return entry;
  }

  return {
    ...entry,
    grid: decodedGrid,
  };
}

export async function setPuzzleProgress(dateKey, payload) {
  // Stored by date so page refresh can restore exactly today's grid state.
  const progress = await getDailyProgress();
  const compressed = {
    ...payload,
    gridEncoded: encodeGrid(payload?.grid),
  };

  delete compressed.grid;
  progress[dateKey] = compressed;
  return setDailyProgress(progress);
}

export async function clearPuzzleProgress(dateKey) {
  const progress = await getDailyProgress();

  if (!Object.prototype.hasOwnProperty.call(progress, dateKey)) {
    return true;
  }

  delete progress[dateKey];
  return setDailyProgress(progress);
}

function toNonNegativeInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.floor(number));
}

function normalizeDateKey(value) {
  const candidate = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return "";
  }

  return candidate;
}

function sanitizeActivityEntry(dateKey, entry) {
  const safeDateKey = normalizeDateKey(dateKey);

  if (!safeDateKey || !entry || typeof entry !== "object") {
    return null;
  }

  return {
    date: safeDateKey,
    solved: Boolean(entry.solved),
    score: toNonNegativeInteger(entry.score),
    timeTaken: toNonNegativeInteger(entry.timeTaken),
    difficulty: Math.max(0, Math.min(3, toNonNegativeInteger(entry.difficulty))),
    synced: Boolean(entry.synced),
    updatedAt: toNonNegativeInteger(entry.updatedAt) || Date.now(),
  };
}

function sanitizeActivityMap(activity) {
  if (!activity || typeof activity !== "object") {
    return {};
  }

  return Object.entries(activity).reduce((acc, [dateKey, entry]) => {
    const sanitized = sanitizeActivityEntry(dateKey, entry);

    if (sanitized) {
      acc[sanitized.date] = sanitized;
    }

    return acc;
  }, {});
}

export async function getDailyActivityMap() {
  const value = await getValue(DAILY_ACTIVITY_KEY);
  return sanitizeActivityMap(value);
}

export async function setDailyActivityMap(activityMap) {
  return setValue(DAILY_ACTIVITY_KEY, sanitizeActivityMap(activityMap));
}

export async function getDailyActivityEntries() {
  const activityMap = await getDailyActivityMap();

  return Object.values(activityMap).sort((left, right) => left.date.localeCompare(right.date));
}

export async function upsertDailyActivityEntry(dateKey, payload) {
  const safeDateKey = normalizeDateKey(dateKey);

  if (!safeDateKey) {
    return false;
  }

  const activityMap = await getDailyActivityMap();
  const previous = activityMap[safeDateKey] || null;
  const nextEntry = sanitizeActivityEntry(safeDateKey, {
    ...previous,
    ...payload,
    date: safeDateKey,
    updatedAt: Date.now(),
  });

  if (!nextEntry) {
    return false;
  }

  // One canonical record per day; latest update overwrites previous snapshot.
  activityMap[safeDateKey] = nextEntry;
  await setDailyActivityMap(activityMap);
  return true;
}

export async function getUnsyncedDailyActivityEntries(limit = 100) {
  const safeLimit = Math.max(1, toNonNegativeInteger(limit) || 1);
  const entries = await getDailyActivityEntries();

  return entries.filter((entry) => entry.solved && !entry.synced).slice(0, safeLimit);
}

export async function markDailyActivityEntriesSynced(dateKeys) {
  if (!Array.isArray(dateKeys) || dateKeys.length === 0) {
    return 0;
  }

  const activityMap = await getDailyActivityMap();
  let updatedCount = 0;

  for (const dateKey of dateKeys) {
    const safeDateKey = normalizeDateKey(dateKey);

    if (!safeDateKey || !activityMap[safeDateKey]) {
      continue;
    }

    activityMap[safeDateKey] = {
      ...activityMap[safeDateKey],
      synced: true,
      updatedAt: Date.now(),
    };
    updatedCount += 1;
  }

  if (updatedCount > 0) {
    await setDailyActivityMap(activityMap);
  }

  return updatedCount;
}

export async function getAchievements() {
  const value = await getValue(ACHIEVEMENTS_KEY);

  if (!value || typeof value !== "object") {
    return {};
  }

  return value;
}

export async function unlockAchievement(key, payload = {}) {
  const safeKey = String(key || "").trim();

  if (!safeKey) {
    return false;
  }

  const achievements = await getAchievements();

  if (achievements[safeKey]) {
    // Achievement unlock is idempotent; do not duplicate badges.
    return false;
  }

  achievements[safeKey] = {
    unlockedAt: Date.now(),
    ...payload,
  };

  await setValue(ACHIEVEMENTS_KEY, achievements);
  return true;
}
