import { requireApiUser } from "@/lib/api-auth";
import { documentUrl, handle, json, parse, readJsonObject } from "@/lib/api-response";
import { applyOps, opSchema } from "@/lib/document-ops";

export function POST(req: Request, ctx: RouteContext<"/api/v1/docs/[id]/sections/[key]/blocks">) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id, key: section } = await ctx.params;
    const { html } = await readJsonObject(req);
    const op = parse(opSchema, { op: "block", section, html });
    const { version, keys } = await applyOps(id, userId, [op]);
    return json({ id, url: documentUrl(req, id), version, key: keys[0] });
  });
}
