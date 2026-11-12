import { getDocument } from "@/lib/documents";
import { renderDocumentPage } from "@/lib/render";

export const dynamic = "force-dynamic";

// Document scripts run in an opaque origin, so they can never act as the
// logged-in dashboard user.
const SANDBOX = "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals";

const headers = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

const notFound = `<!doctype html><meta charset="utf-8"><title>Not found</title><body style="background:#0b0b0c;color:#b9b9be;font:16px system-ui,sans-serif;padding:48px">Document not found.</body>`;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return new Response(notFound, { status: 404, headers });
  const liveUrl = `${new URL(request.url).origin}/api/live/${encodeURIComponent(id)}`;
  return new Response(renderDocumentPage(doc, { liveUrl }), {
    headers: { ...headers, "Content-Security-Policy": SANDBOX },
  });
}
