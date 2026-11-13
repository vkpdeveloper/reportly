// Renders a document as one self-contained page in the html-communication
// template. Pure (no Cloudflare imports) so it can be rendered to a file and checked.
import { sectionInnerHtml } from "./section-html";
import { templateCss } from "./template/css";
import { liveClientJs } from "./template/live";
import { reportRuntimeJs } from "./template/runtime";
import { commentsJs } from "./template/comments";
import { diagramsJs, navJs, widgetsJs } from "./template/scripts";
import type { Comment } from "./comments";
import type { FullDocument } from "./types";

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => escapes[c]);
}

function renderSections(doc: FullDocument): string {
  // An empty document still gets a hero; the live client swaps it out once sections arrive.
  if (!doc.sections.length) return `<section>\n  <h1>${escapeHtml(doc.title)}</h1>\n</section>`;
  return doc.sections
    .map((s) => {
      const nav = s.nav ? ` data-nav="${escapeHtml(s.nav)}"` : "";
      // An empty section renders as <section></section>, which the page shows as pending.
      return `<section id="${escapeHtml(s.key)}"${nav}>${sectionInnerHtml(s).trim()}</section>`;
    })
    .join("\n\n");
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** Plain text of the hero's lede, for link previews. */
function ledeText(doc: FullDocument) {
  const match = doc.sections[0]?.html.match(/<p\b[^>]*class="[^"]*\blede\b[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  if (!match) return "";
  const text = match[1]
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => entities[name])
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text;
}

function previewMeta(doc: FullDocument) {
  const state = doc.status === "done" ? "Done" : "Writing";
  const lede = ledeText(doc);
  const description = escapeHtml(`${doc.project} · ${state}${lede ? `. ${lede}` : ""}`);
  const title = escapeHtml(doc.title);
  return [
    `<meta name="description" content="${description}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Reportly">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
  ].join("\n");
}

export function renderDocumentPage(doc: FullDocument, opts: { liveUrl: string; comments: Comment[] }): string {
  const title = escapeHtml(doc.title);
  const live = liveClientJs({
    id: doc.id,
    version: doc.version,
    status: doc.status,
    updatedAt: doc.updatedAt,
    liveUrl: opts.liveUrl,
    comments: opts.comments,
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${previewMeta(doc)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
<style>${templateCss}</style>
<script>${reportRuntimeJs}</script>
</head>
<body>
<div class="shell">
<nav class="side" aria-label="Sections">
  <a class="brand" href="#top">${title}</a>
  <div class="status" data-status="${doc.status}">
    <span class="state">${doc.status === "done" ? "Done" : "Writing"}</span>
    <button type="button" class="btn pdf" aria-label="Download as PDF">Save PDF</button>
    <span class="when"></span>
  </div>
  <ol></ol>
</nav>

<main id="top">
${renderSections(doc)}
</main>
</div>

<script>${live}</script>
<script>${navJs}</script>
<script>${diagramsJs}</script>
<script>${widgetsJs}</script>
<script>${commentsJs}</script>
</body>
</html>
`;
}
