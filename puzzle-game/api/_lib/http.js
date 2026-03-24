function setApiSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

// Consistent JSON response helper used by all API handlers.
export function json(res, statusCode, payload) {
  setApiSecurityHeaders(res);
  res.status(statusCode);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req) {
  // Vercel can pre-parse body for JSON requests.
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  // Some runtimes provide string body only.
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  if (!req.readable) {
    return {};
  }

  // Manual stream parsing fallback for raw Node incoming requests.
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}
