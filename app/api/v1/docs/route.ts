import { requireApiUser } from "@/lib/api-auth";
import { documentUrl, handle, json, parse, readJsonObject } from "@/lib/api-response";
import { createBodySchema, createDocument } from "@/lib/document-ops";
import { listDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const input = parse(createBodySchema, await readJsonObject(req));
    const { id, version } = await createDocument(userId, input);
    return json({ id, url: documentUrl(req, id), version }, 201);
  });
}

export function GET(req: Request) {
  return handle(async () => {
    const userId = await requireApiUser(req);
    const params = new URL(req.url).searchParams;
    const documents = await listDocuments(userId, {
      q: params.get("q") || undefined,
      project: params.get("project") || undefined,
    });
    return json({ documents: documents.map((d) => ({ ...d, url: documentUrl(req, d.id) })) });
  });
}
