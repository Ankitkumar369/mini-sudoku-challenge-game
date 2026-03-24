const buckets = new Map();
const DEFAULT_WINDOW_MS = 60 * 1000;

function normalizeOrigin(value) {
  const candidate = String(value || "").trim();

  if (!candidate) {
    return "";
  }

  try {
    const parsed = new URL(candidate);
    return parsed.origin;
  } catch {
    return "";
  }
}

function getRequestHost(req) {
  const forwardedHost = String(req.headers?.["x-forwarded-host"] || "").trim();
  const hostHeader = String(req.headers?.host || "").trim();
  const rawHost = forwardedHost || hostHeader;

  if (!rawHost) {
    return "";
  }

  return rawHost.split(",")[0].trim();
}

function getRequestProtocol(req) {
  const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "").trim();
  return (forwardedProto.split(",")[0] || "https").trim();
}

function getCurrentOrigin(req) {
  const host = getRequestHost(req);

  if (!host) {
    return "";
  }

  return normalizeOrigin(`${getRequestProtocol(req)}://${host}`);
}

function getAllowedOrigins(req) {
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  const publicAppUrl = normalizeOrigin(process.env.PUBLIC_APP_URL);
  const currentOrigin = getCurrentOrigin(req);

  return new Set([currentOrigin, publicAppUrl, ...configured].filter(Boolean));
}

function getClientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").trim();

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return String(req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown");
}

function cleanupExpiredBuckets(nowMs) {
  if (buckets.size < 2000) {
    return;
  }

  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= nowMs) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(req, options = {}) {
  const max = Number.isFinite(Number(options.max)) ? Math.max(1, Number(options.max)) : 60;
  const windowMs = Number.isFinite(Number(options.windowMs))
    ? Math.max(1000, Number(options.windowMs))
    : DEFAULT_WINDOW_MS;
  const keyPrefix = String(options.key || "api").trim() || "api";
  const ip = getClientIp(req);
  const nowMs = Date.now();
  const bucketKey = `${keyPrefix}:${ip}`;
  const existing = buckets.get(bucketKey);

  cleanupExpiredBuckets(nowMs);

  if (!existing || existing.resetAt <= nowMs) {
    const created = {
      count: 1,
      resetAt: nowMs + windowMs,
    };
    buckets.set(bucketKey, created);
    return {
      allowed: true,
      limit: max,
      remaining: Math.max(0, max - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);

  const remaining = Math.max(0, max - existing.count);

  return {
    allowed: existing.count <= max,
    limit: max,
    remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
  };
}

export function applyRateLimitHeaders(res, rateInfo) {
  res.setHeader("X-RateLimit-Limit", String(rateInfo.limit));
  res.setHeader("X-RateLimit-Remaining", String(rateInfo.remaining));
  res.setHeader("Retry-After", String(rateInfo.retryAfterSeconds));
}

export function isAllowedMutationOrigin(req) {
  const origin = normalizeOrigin(req.headers?.origin);

  // Non-browser clients (curl/server-to-server) may not send Origin.
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins(req);
  return allowedOrigins.has(origin);
}
