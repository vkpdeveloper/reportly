import { getCloudflareContext } from "@opennextjs/cloudflare";

export function db() {
  return getCloudflareContext().env.DB;
}
