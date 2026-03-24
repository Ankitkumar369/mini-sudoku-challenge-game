import { json, readJsonBody } from "../_lib/http.js";
import { getSqlClient, isDatabaseConfigured } from "../_lib/neon.js";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  isAllowedMutationOrigin,
} from "../_lib/guards.js";

const CREATE_USERS_TABLE_SQL = `
  create table if not exists app_users (
    id text primary key,
    name text,
    email text,
    avatar_url text,
    provider text not null,
    last_seen_at timestamptz not null default now()
  );
`;

export default async function handler(req, res) {
  const rateInfo = checkRateLimit(req, { key: "users-upsert", max: 25, windowMs: 60 * 1000 });
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

  try {
    const body = await readJsonBody(req);

    const user = {
      id: String(body.id || "").trim(),
      name: body.name ? String(body.name) : null,
      email: body.email ? String(body.email) : null,
      avatarUrl: body.avatarUrl ? String(body.avatarUrl) : null,
      provider: String(body.provider || "").trim(),
    };

    if (!user.id || !user.provider) {
      return json(res, 400, {
        error: "id and provider are required",
      });
    }

    if (user.id.length > 128 || user.provider.length > 32) {
      return json(res, 400, {
        error: "id/provider size is invalid",
      });
    }

    if (!isDatabaseConfigured()) {
      return json(res, 200, { ok: true, persisted: false });
    }

    const sql = getSqlClient();

    await sql(CREATE_USERS_TABLE_SQL);

    await sql`
      insert into app_users (id, name, email, avatar_url, provider, last_seen_at)
      values (${user.id}, ${user.name}, ${user.email}, ${user.avatarUrl}, ${user.provider}, now())
      on conflict (id)
      do update set
        name = excluded.name,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        provider = excluded.provider,
        last_seen_at = now();
    `;

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Failed to upsert user",
    });
  }
}
