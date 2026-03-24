// Imports: crypto nonce generator and shared request/response helpers.
import { randomUUID } from "node:crypto";
import { json, readJsonBody } from "../../_lib/http.js";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  isAllowedMutationOrigin,
} from "../../_lib/guards.js";

const DEFAULT_AUTH_URL = "https://oauth.truecaller.com/v1/authorize";

function readEnv(primaryKey, legacyKey = "") {
  return process.env[primaryKey] || (legacyKey ? process.env[legacyKey] : "") || "";
}

function normalizeOrigin(value) {
  const candidate = String(value || "").trim();

  if (!candidate) {
    return "";
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

function getCurrentOrigin(req) {
  const forwardedHost = String(req.headers?.["x-forwarded-host"] || "").trim();
  const hostHeader = String(req.headers?.host || "").trim();
  const host = (forwardedHost || hostHeader).split(",")[0].trim();
  const proto = String(req.headers?.["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();

  if (!host) {
    return "";
  }

  return normalizeOrigin(`${proto}://${host}`);
}

function isAllowedRedirectUri(redirectUri, req) {
  const redirectOrigin = normalizeOrigin(redirectUri);

  if (!redirectOrigin) {
    return false;
  }

  const publicAppOrigin = normalizeOrigin(process.env.PUBLIC_APP_URL);
  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
  const currentOrigin = getCurrentOrigin(req);
  const allowed = new Set([publicAppOrigin, currentOrigin, ...allowedOrigins].filter(Boolean));

  if (allowed.size === 0) {
    // Backward-compatible fallback for local tests/legacy env.
    return true;
  }

  return allowed.has(redirectOrigin);
}

export default async function handler(req, res) {
  const rateInfo = checkRateLimit(req, { key: "truecaller-start", max: 12, windowMs: 60 * 1000 });
  applyRateLimitHeaders(res, rateInfo);

  if (!rateInfo.allowed) {
    return json(res, 429, { ok: false, error: "Too many requests. Please retry shortly." });
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!isAllowedMutationOrigin(req)) {
    return json(res, 403, { ok: false, error: "Origin not allowed" });
  }

  // Supports both correct key and common typo key for smoother migration.
  const clientId = readEnv("TRUECALLER_CLIENT_ID", "TRUECALLLER_CLIENT_ID");

  if (!clientId) {
    return json(res, 500, { error: "TRUECALLER_CLIENT_ID is not set" });
  }

  const body = await readJsonBody(req);
  const redirectUri =
    body.redirectUri || readEnv("TRUECALLER_REDIRECT_URI", "TRUECALLLER_REDIRECT_URI") || null;

  if (!redirectUri) {
    return json(res, 400, {
      error: "redirectUri is required (request body or TRUECALLER_REDIRECT_URI)",
    });
  }

  if (!isAllowedRedirectUri(redirectUri, req)) {
    return json(res, 400, {
      error: "redirectUri origin is not allowed",
    });
  }

  const authorizeUrl = new URL(
    process.env.TRUECALLER_AUTH_BASE_URL || DEFAULT_AUTH_URL
  );

  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set(
    "scope",
    readEnv("TRUECALLER_SCOPE", "TRUECALLLER_SCOPE") || "openid profile phone"
  );
  authorizeUrl.searchParams.set(
    "state",
    Buffer.from(
      JSON.stringify({
        nonce: randomUUID(),
        issuedAt: Date.now(),
      })
    ).toString("base64url")
  );

  return json(res, 200, {
    authorizeUrl: authorizeUrl.toString(),
  });
}
