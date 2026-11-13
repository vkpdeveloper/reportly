import { requireApiUser } from "@/lib/api-auth";
import { ApiError, handle, json } from "@/lib/api-response";
import { mediaUrl, uploadMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

/** `POST /api/v1/docs/:id/media?name=rec-01.mp4` with the raw file as the body. */
export function POST(req: Request, ctx: RouteContext<"/api/v1/docs/[id]/media">) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const { id } = await ctx.params;
    const name = new URL(req.url).searchParams.get("name");
    if (!name) throw new ApiError(400, "name: give the file name, e.g. ?name=rec-01.mp4");
    const file = await uploadMedia(req, id, userId, name);
    return json({ ...file, url: mediaUrl(new URL(req.url).origin, file.id, file.name) }, 201);
  });
}
