import { deleteValue, getValue, setValue } from "./indexedDb";

const SESSION_USER_KEY = "session.user";
const DAILY_PROGRESS_KEY = "progress.daily";

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
  return progress[dateKey] || null;
}

export async function setPuzzleProgress(dateKey, payload) {
  const progress = await getDailyProgress();
  progress[dateKey] = payload;
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
