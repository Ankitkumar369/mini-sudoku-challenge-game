// Imports: common JSON response helper for API routes.
import { json } from "../../_lib/http.js";
import { applyRateLimitHeaders, checkRateLimit } from "../../_lib/guards.js";

function readEnv(primaryKey, legacyKey = "") {
  return process.env[primaryKey] || (legacyKey ? process.env[legacyKey] : "") || "";
}

// Decode the JWT payload section (id_token) when userinfo endpoint is unavailable.
function decodeJwtPayload(token) {
  const sections = token.split(".");

  if (sections.length < 2) {
    return null;
  }

  try {
    const payload = Buffer.from(sections[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// Normalize provider-specific profile fields to one app-level user shape.
function normalizeUserProfile(profile, provider = "truecaller") {
  return {
    id: profile.sub || profile.user_id || profile.phone_number || "",
    name: profile.name || profile.given_name || "",
    email: profile.email || "",
    phone: profile.phone_number || profile.phone || "",
    avatarUrl: profile.picture || profile.avatar || "",
    provider,
  };
}

// Read and validate required Truecaller environment configuration.
function getTruecallerConfig() {
  const config = {
    clientId: readEnv("TRUECALLER_CLIENT_ID", "TRUECALLLER_CLIENT_ID"),
    clientSecret: readEnv("TRUECALLER_CLIENT_SECRET", "TRUECALLLER_CLIENT_SECRET"),
    tokenUrl: readEnv("TRUECALLER_TOKEN_URL", "TRUECALLLER_TOKEN_URL"),
    redirectUri: readEnv("TRUECALLER_REDIRECT_URI", "TRUECALLLER_REDIRECT_URI"),
    userInfoUrl: readEnv("TRUECALLER_USERINFO_URL", "TRUECALLLER_USERINFO_URL"),
  };

  const isValid =
    Boolean(config.clientId) &&
    Boolean(config.clientSecret) &&
    Boolean(config.tokenUrl) &&
    Boolean(config.redirectUri);

  return { config, isValid };
}

// OAuth token exchange requires application/x-www-form-urlencoded body.
function buildTokenRequestBody(code, config) {
  const formData = new URLSearchParams();
  formData.set("grant_type", "authorization_code");
  formData.set("code", String(code));
  formData.set("client_id", config.clientId);
  formData.set("client_secret", config.clientSecret);
  formData.set("redirect_uri", config.redirectUri);
  return formData;
}

// Step 1 of callback: exchange authorization code for access token.
async function exchangeCodeForToken(code, config) {
  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: buildTokenRequestBody(code, config),
  });

  const tokenPayload = await tokenResponse.json().catch(() => ({}));

  return {
    ok: tokenResponse.ok,
    statusCode: tokenResponse.status,
    tokenPayload,
  };
}

// Step 2 (preferred): fetch profile from userinfo endpoint using access token.
async function fetchProfileFromUserInfo(config, accessToken) {
  if (!config.userInfoUrl || !accessToken) {
    return null;
  }

  const response = await fetch(config.userInfoUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json().catch(() => null);
}

// Fallback order: userinfo -> id_token decode -> empty object.
async function resolveProfile(config, tokenPayload) {
  const profileFromUserInfo = await fetchProfileFromUserInfo(config, tokenPayload.access_token);

  if (profileFromUserInfo) {
    return profileFromUserInfo;
  }

  if (tokenPayload.id_token) {
    return decodeJwtPayload(tokenPayload.id_token) || {};
  }

  return {};
}

// Ensure we always return a usable user object, even when provider omits id.
function createTruecallerUser(profile) {
  const user = normalizeUserProfile(profile, "truecaller");

  if (!user.id) {
    user.id = `truecaller_${Date.now()}`;
  }

  return user;
}

function createInvalidConfigResponse(res) {
  return json(res, 500, {
    error:
      "TRUECALLER_CLIENT_ID, TRUECALLER_CLIENT_SECRET, TRUECALLER_TOKEN_URL, and TRUECALLER_REDIRECT_URI must be set",
  });
}

export default async function handler(req, res) {
  const rateInfo = checkRateLimit(req, { key: "truecaller-callback", max: 30, windowMs: 60 * 1000 });
  applyRateLimitHeaders(res, rateInfo);

  if (!rateInfo.allowed) {
    return json(res, 429, { ok: false, error: "Too many requests. Please retry shortly." });
  }

  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  // Truecaller redirects with authorization code in query params.
  const code = req.query?.code;

  if (!code) {
    return json(res, 400, { error: "Truecaller callback is missing code" });
  }

  const { config, isValid } = getTruecallerConfig();

  if (!isValid) {
    return createInvalidConfigResponse(res);
  }

  try {
    const tokenResult = await exchangeCodeForToken(code, config);

    if (!tokenResult.ok) {
      return json(res, tokenResult.statusCode, {
        error:
          tokenResult.tokenPayload.error_description ||
          tokenResult.tokenPayload.error ||
          "Token exchange failed",
      });
    }

    const profile = await resolveProfile(config, tokenResult.tokenPayload);
    const user = createTruecallerUser(profile);

    return json(res, 200, {
      user,
      tokenType: tokenResult.tokenPayload.token_type || "",
      expiresIn: tokenResult.tokenPayload.expires_in || null,
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Truecaller callback failed",
    });
  }
}
