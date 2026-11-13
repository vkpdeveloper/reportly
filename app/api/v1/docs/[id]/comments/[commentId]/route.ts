import { requireApiUser } from "@/lib/api-auth";
import { ApiError, handle, json } from "@/lib/api-response";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export function DELETE(req: Request, ctx: RouteContext<"/api/v1/docs/[id]/comments/[commentId]">) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id, commentId } = await ctx.params;
    const result = await db()
      .prepare("DELETE FROM comments WHERE id = ? AND doc_id = (SELECT id FROM documents WHERE id = ? AND user_id = ?)")
      .bind(commentId, id, userId)
      .run();
    if (result.meta.changes === 0) throw new ApiError(404, "comment not found");
    return json({ deleted: true });
  });
}
