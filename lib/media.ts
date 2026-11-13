// Built-in media storage: files go to the MEDIA R2 bucket, keyed by an
// unguessable id, with a D1 row that ties each one to its document.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ApiError } from "./api-response";
import { db } from "./db";
import { randomString } from "./ids";

// Workers accept request bodies up to 100 MB on the Free and Pro plans.
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

// Content type comes from the extension, never from the uploader, so a file can
// only ever be served as one of these.
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
};

function bucket() {
  return getCloudflareContext().env.MEDIA;
}

/** A url-safe file name and its content type, or a 415 for types we do not serve. */
export function mediaName(raw: string) {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const name = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-100);
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  const contentType = TYPES[ext];
  if (!contentType) throw new ApiError(415, `unsupported file type ".${ext}", use one of ${Object.keys(TYPES).join(", ")}`);
  return { name, contentType };
}

export function mediaUrl(origin: string, id: string, name: string) {
  return `${origin}/m/${id}/${name}`;
}

/** Streams the request body into R2. The document must belong to `userId`. */
export async function uploadMedia(req: Request, docId: string, userId: string, rawName: string) {
  const { name, contentType } = mediaName(rawName);
  const size = Number(req.headers.get("content-length"));
  if (!req.body || !Number.isSafeInteger(size) || size <= 0) throw new ApiError(411, "send the file as the body, with a Content-Length");
  if (size > MAX_MEDIA_BYTES) throw new ApiError(413, "file is larger than 100 MB");

  const doc = await db().prepare("SELECT 1 FROM documents WHERE id = ? AND user_id = ?").bind(docId, userId).first();
  if (!doc) throw new ApiError(404, "document not found");

  const id = randomString(20);
  // R2 needs the length up front to stream; FixedLengthStream also rejects a body that lies about it.
  const { readable, writable } = new FixedLengthStream(size);
  const piped = req.body.pipeTo(writable);
  await Promise.all([bucket().put(id, readable, { httpMetadata: { contentType } }), piped]);
  await db()
    .prepare("INSERT INTO media (id, doc_id, name, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, docId, name, contentType, size, Date.now())
    .run();
  return { id, name, contentType, size };
}

/** Deletes a document, its rows, and its files. Returns false when it is not the user's. */
export async function deleteDocumentWithMedia(docId: string, userId: string) {
  const { results } = await db()
    .prepare("SELECT media.id FROM media JOIN documents ON documents.id = media.doc_id WHERE documents.id = ? AND documents.user_id = ?")
    .bind(docId, userId)
    .all<{ id: string }>();
  // Sections, blocks, comments and media rows go with it through ON DELETE CASCADE.
  const result = await db().prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").bind(docId, userId).run();
  if (result.meta.changes === 0) return false;
  // The rows are gone first, so even if this fails the files are no longer served.
  const ids = results.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 1000) await bucket().delete(ids.slice(i, i + 1000));
  return true;
}
