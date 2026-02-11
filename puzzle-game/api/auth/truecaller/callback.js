import { json } from "../../_lib/http.js";

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const code = req.query?.code;

  if (!code) {
    return json(res, 400, { error: "Truecaller callback is missing code" });
  }

  const clientId = process.env.TRUECALLER_CLIENT_ID;
  const clientSecret = process.env.TRUECALLER_CLIENT_SECRET;
  const tokenUrl = process.env.TRUECALLER_TOKEN_URL;
  const redirectUri = process.env.TRUECALLER_REDIRECT_URI;

  if (!clientId || !clientSecret || !tokenUrl || !redirectUri) {
    return json(res, 500, {
      error:
        "TRUECALLER_CLIENT_ID, TRUECALLER_CLIENT_SECRET, TRUECALLER_TOKEN_URL, and TRUECALLER_REDIRECT_URI must be set",
    });
  }

  try {
    const formData = new URLSearchParams();
    formData.set("grant_type", "authorization_code");
    formData.set("code", String(code));
    formData.set("client_id", clientId);
    formData.set("client_secret", clientSecret);
    formData.set("redirect_uri", redirectUri);

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const tokenPayload = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok) {
      return json(res, tokenResponse.status, {
        error: tokenPayload.error_description || tokenPayload.error || "Token exchange failed",
      });
    }

    let profile = null;

    if (process.env.TRUECALLER_USERINFO_URL && tokenPayload.access_token) {
      const userInfoResponse = await fetch(process.env.TRUECALLER_USERINFO_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      });

      if (userInfoResponse.ok) {
        profile = await userInfoResponse.json().catch(() => null);
      }
    }

    if (!profile && tokenPayload.id_token) {
      profile = decodeJwtPayload(tokenPayload.id_token);
    }

    if (!profile) {
      profile = {};
    }

    const user = normalizeUserProfile(profile, "truecaller");

    if (!user.id) {
      user.id = `truecaller_${Date.now()}`;
    }

    return json(res, 200, {
      user,
      tokenType: tokenPayload.token_type || "",
      expiresIn: tokenPayload.expires_in || null,
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Truecaller callback failed",
    });
  }
}