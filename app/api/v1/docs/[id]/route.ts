import { requireApiUser } from "@/lib/api-auth";
import { ApiError, documentUrl, handle, json, parse, readJsonObject } from "@/lib/api-response";
import { applyOps, metaBodySchema } from "@/lib/document-ops";
import { getDocument } from "@/lib/documents";
import { deleteDocumentWithMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/v1/docs/[id]">;

export function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id } = await ctx.params;
    const doc = await getDocument(id);
    if (!doc || doc.userId !== userId) throw new ApiError(404, "document not found");
    return json({
      id: doc.id,
      url: documentUrl(req, id),
      title: doc.title,
      project: doc.project,
      status: doc.status,
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      sections: doc.sections,
    });
  });
}

export function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id } = await ctx.params;
    const meta = parse(metaBodySchema, await readJsonObject(req));
    const { version } = await applyOps(id, userId, [{ op: "meta", ...meta }]);
    return json({ id, url: documentUrl(req, id), version });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id } = await ctx.params;
    if (!(await deleteDocumentWithMedia(id, userId))) throw new ApiError(404, "document not found");
    return json({ deleted: true });
  });
}
