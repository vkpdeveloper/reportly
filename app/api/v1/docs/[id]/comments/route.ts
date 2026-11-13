import { requireApiUser } from "@/lib/api-auth";
import { ApiError, handle, json, parse, readJsonObject } from "@/lib/api-response";
import { addComment, commentBodySchema, listComments } from "@/lib/comments";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/v1/docs/[id]/comments">;

async function requireOwnDoc(req: Request, ctx: Ctx) {
  const userId = await requireApiUser(req);
  const { id } = await ctx.params;
  const doc = await db().prepare("SELECT 1 FROM documents WHERE id = ? AND user_id = ?").bind(id, userId).first();
  if (!doc) throw new ApiError(404, "document not found");
  return id;
}

/** `GET /api/v1/docs/:id/comments?since=<unix ms>`, oldest first. */
export function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const id = await requireOwnDoc(req, ctx);
    const since = Number.parseInt(new URL(req.url).searchParams.get("since") ?? "", 10) || 0;
    return json({ comments: await listComments(id, since) });
  });
}

/** The agent's own comment, marked fromAgent so readers can tell it apart. */
export function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const id = await requireOwnDoc(req, ctx);
    const input = parse(commentBodySchema, await readJsonObject(req));
    return json({ comment: await addComment(id, input, true) }, 201);
  });
}
