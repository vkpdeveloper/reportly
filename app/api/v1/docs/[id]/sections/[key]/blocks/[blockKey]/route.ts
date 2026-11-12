import { requireApiUser } from "@/lib/api-auth";
import { documentUrl, handle, json, parse, readJsonObject } from "@/lib/api-response";
import { applyOps, opSchema } from "@/lib/document-ops";

type Ctx = RouteContext<"/api/v1/docs/[id]/sections/[key]/blocks/[blockKey]">;

export function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id, key: section, blockKey } = await ctx.params;
    const op = parse(opSchema, { ...(await readJsonObject(req)), op: "block", section, key: blockKey });
    const { version } = await applyOps(id, userId, [op]);
    return json({ id, url: documentUrl(req, id), version });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id, key: section, blockKey } = await ctx.params;
    const op = parse(opSchema, { op: "remove_block", section, key: blockKey });
    const { version } = await applyOps(id, userId, [op]);
    return json({ id, url: documentUrl(req, id), version });
  });
}
