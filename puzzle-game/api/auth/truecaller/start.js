// Imports: crypto nonce generator and shared request/response helpers.
import { randomUUID } from "node:crypto";
import { json, readJsonBody } from "../../_lib/http.js";

const DEFAULT_AUTH_URL = "https://oauth.truecaller.com/v1/authorize";

function readEnv(primaryKey, legacyKey = "") {
  return process.env[primaryKey] || (legacyKey ? process.env[legacyKey] : "") || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
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
