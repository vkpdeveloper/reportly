// Public polling endpoint for open viewers (every 3 s each), so the unchanged
// case is one tiny indexed read and changed sections are the only html sent.
import { errorJson, json } from "@/lib/api-response";
import { db } from "@/lib/db";
import { sectionInnerHtml } from "@/lib/section-html";
import type { DocumentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// Viewer pages run sandboxed in an opaque origin, so they need CORS for this.
const CORS = { "Access-Control-Allow-Origin": "*" };

type Head = { version: number; status: DocumentStatus; title: string };
type LiveSection = { key: string; nav: string | null; rev: number; html?: string };

export async function GET(req: Request, ctx: RouteContext<"/api/live/[id]">) {
  const { id } = await ctx.params;
  const since = Number.parseInt(new URL(req.url).searchParams.get("since") ?? "", 10) || 0;

  const head = await db().prepare("SELECT version, status, title FROM documents WHERE id = ?").bind(id).first<Head>();
  if (!head) return errorJson(404, "document not found", CORS);
  if (head.version === since) return json({ version: head.version, status: head.status }, 200, CORS);

  // Re-read the head with the sections in one batch so the response is a consistent snapshot.
  const [docResult, sectionResult, blockResult] = await db().batch<Record<string, string | number | null>>([
    db().prepare("SELECT version, status, title FROM documents WHERE id = ?").bind(id),
    db()
      .prepare("SELECT key, nav, rev, CASE WHEN rev > ?2 THEN html END AS html FROM sections WHERE doc_id = ?1 ORDER BY position")
      .bind(id, since),
    db()
      .prepare(
        `SELECT b.section_key, b.html FROM blocks b
         JOIN sections s ON s.doc_id = b.doc_id AND s.key = b.section_key
         WHERE b.doc_id = ?1 AND s.rev > ?2 ORDER BY b.position`,
      )
      .bind(id, since),
  ]);
  const doc = docResult.results[0] as Head | undefined;
  if (!doc) return errorJson(404, "document not found", CORS);

  const blocksBySection = new Map<string, { html: string }[]>();
  for (const block of blockResult.results as { section_key: string; html: string }[]) {
    const list = blocksBySection.get(block.section_key) ?? [];
    list.push({ html: block.html });
    blocksBySection.set(block.section_key, list);
  }

  const rows = sectionResult.results as { key: string; nav: string | null; rev: number; html: string | null }[];
  const sections = rows.map((s): LiveSection => {
    if (s.html === null) return { key: s.key, nav: s.nav, rev: s.rev };
    const html = sectionInnerHtml({ html: s.html, blocks: blocksBySection.get(s.key) ?? [] });
    return { key: s.key, nav: s.nav, rev: s.rev, html };
  });

  return json({ version: doc.version, status: doc.status, title: doc.title, sections }, 200, CORS);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
    },
  });
}
