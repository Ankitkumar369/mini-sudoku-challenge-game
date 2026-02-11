import { randomUUID } from "node:crypto";
import { json, readJsonBody } from "../../_lib/http.js";

const DEFAULT_AUTH_URL = "https://oauth.truecaller.com/v1/authorize";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const clientId = process.env.TRUECALLER_CLIENT_ID;

  if (!clientId) {
    return json(res, 500, { error: "TRUECALLER_CLIENT_ID is not set" });
  }

  const body = await readJsonBody(req);
  const redirectUri =
    body.redirectUri || process.env.TRUECALLER_REDIRECT_URI || null;

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
    process.env.TRUECALLER_SCOPE || "openid profile phone"
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