import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ApiError } from "./api-response";
import { db } from "./db";
import { sha256Hex } from "./ids";

const TOKEN = /^rpt_[0-9A-Za-z]{40}$/;
// last_used_at is informational, so skip the write when it was refreshed recently.
const TOUCH_INTERVAL_MS = 60_000;

/** Resolves `Authorization: Bearer rpt_...` to its user id, or throws a 401 ApiError. */
export async function requireApiUser(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token || !TOKEN.test(token)) throw new ApiError(401, "missing or invalid API token");

  const row = await db()
    .prepare("SELECT id, user_id, last_used_at FROM api_tokens WHERE token_hash = ?")
    .bind(await sha256Hex(token))
    .first<{ id: string; user_id: string; last_used_at: number | null }>();
  if (!row) throw new ApiError(401, "missing or invalid API token");

  const now = Date.now();
  if (row.last_used_at === null || now - row.last_used_at > TOUCH_INTERVAL_MS) {
    const touch = db().prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").bind(now, row.id).run();
    getCloudflareContext().ctx.waitUntil(touch.catch((error) => console.error("token touch failed", error)));
  }
  return row.user_id;
}
