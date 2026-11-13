// Serves /m/<id>/<name> straight from R2, before Next sees the request, so
// video range requests stay cheap and keep their exact lengths. Anyone with the
// url can load the file, like the document that uses it. The name is only for
// readers; the id finds the file.

const PATH = /^\/m\/([0-9a-z]{20})\/[^/]+$/;

const baseHeaders = {
  // A file can never run script as this origin, even an svg opened directly.
  "Content-Security-Policy": "sandbox",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Accept-Ranges": "bytes",
};

function plain(status: number, text: string) {
  return new Response(text, { status, headers: { ...baseHeaders, "Cache-Control": "no-store" } });
}

function hasBody(object: R2Object): object is R2ObjectBody {
  return "body" in object;
}

function byteRange(range: R2Range, size: number) {
  // R2 can report every key, with the unused ones undefined.
  if ("suffix" in range && typeof range.suffix === "number") return { start: Math.max(0, size - range.suffix), end: size - 1 };
  const start = "offset" in range && typeof range.offset === "number" ? range.offset : 0;
  const end = "length" in range && typeof range.length === "number" ? start + range.length - 1 : size - 1;
  return { start, end };
}

/** The response for a media url, or null when the request is not for one. */
export async function serveMedia(req: Request, env: CloudflareEnv): Promise<Response | null> {
  const id = PATH.exec(new URL(req.url).pathname)?.[1];
  if (!id) return null;
  if (req.method !== "GET" && req.method !== "HEAD") return plain(405, "method not allowed");

  // Only files whose document still exists are served.
  const row = await env.DB.prepare("SELECT content_type FROM media WHERE id = ?").bind(id).first<{ content_type: string }>();
  if (!row) return plain(404, "not found");

  const wantsRange = req.method === "GET" && req.headers.has("range");
  let object: R2Object | null;
  try {
    object =
      req.method === "HEAD"
        ? await env.MEDIA.head(id)
        : await env.MEDIA.get(id, { onlyIf: req.headers, range: wantsRange ? req.headers : undefined });
  } catch {
    return plain(416, "range not satisfiable");
  }
  if (!object) return plain(404, "not found");

  const headers = new Headers(baseHeaders);
  headers.set("Content-Type", row.content_type);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  if (!hasBody(object)) {
    // HEAD, or If-None-Match matched (R2 returns no body when a precondition holds back the file).
    headers.set("Content-Length", String(object.size));
    return new Response(null, { status: req.method === "HEAD" ? 200 : 304, headers });
  }
  if (wantsRange && object.range) {
    const { start, end } = byteRange(object.range, object.size);
    headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
