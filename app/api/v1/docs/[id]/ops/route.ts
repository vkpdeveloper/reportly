import { requireApiUser } from "@/lib/api-auth";
import { documentUrl, handle, json, parse, readJsonObject } from "@/lib/api-response";
import { applyOps, opsBodySchema } from "@/lib/document-ops";

export function POST(req: Request, ctx: RouteContext<"/api/v1/docs/[id]/ops">) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id } = await ctx.params;
    const { ops } = parse(opsBodySchema, await readJsonObject(req));
    const { version, keys } = await applyOps(id, userId, ops);
    return json({ id, url: documentUrl(req, id), version, ...(keys.length > 0 && { keys }) });
  });
}
