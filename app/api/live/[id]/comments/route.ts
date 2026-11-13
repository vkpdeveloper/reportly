// Public comments for viewers. Like the document itself, anyone with the link
// can read and post. Viewer pages run in an opaque origin, so this needs CORS
// and never uses cookies.
import { handle, json, parse, readJsonObject } from "@/lib/api-response";
import { addComment, commentBodySchema, listComments } from "@/lib/comments";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*" };

async function withCors(res: Promise<Response>) {
  const out = await res;
  out.headers.set("Access-Control-Allow-Origin", "*");
  return out;
}

export function GET(_req: Request, ctx: RouteContext<"/api/live/[id]/comments">) {
  return withCors(
    handle(async () => {
      const { id } = await ctx.params;
      return json({ comments: await listComments(id) });
    }),
  );
}

export function POST(req: Request, ctx: RouteContext<"/api/live/[id]/comments">) {
  return withCors(
    handle(async () => {
      const { id } = await ctx.params;
      const input = parse(commentBodySchema, await readJsonObject(req));
      return json({ comment: await addComment(id, input, false) }, 201);
    }),
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
    },
  });
}
