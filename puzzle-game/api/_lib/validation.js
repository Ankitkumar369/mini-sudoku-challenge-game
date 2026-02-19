function toSafeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function toInteger(value) {
  const number = toSafeNumber(value);
  return number === null ? null : Math.floor(number);
}

export function toNonNegativeInteger(value) {
  const number = toInteger(value);
  return number === null ? 0 : Math.max(0, number);
}

export function clampInteger(value, minValue, maxValue) {
  const number = toInteger(value);

  if (number === null) {
    return minValue;
  }

  return Math.min(maxValue, Math.max(minValue, number));
}

export function normalizeDateKey(value) {
  const candidate = String(value || "").trim();

  if (!candidate) {
    return "";
  }

  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeOptionalDateKey(value) {
  const normalized = normalizeDateKey(value);
  return normalized || null;
}
