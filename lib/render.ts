// Renders a document as one self-contained page in the html-communication
// template. Pure (no Cloudflare imports) so it can be rendered to a file and checked.
import { sectionInnerHtml } from "./section-html";
import { templateCss } from "./template/css";
import { liveClientJs } from "./template/live";
import { reportRuntimeJs } from "./template/runtime";
import { diagramsJs, navJs, widgetsJs } from "./template/scripts";
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
      return `<section id="${escapeHtml(s.key)}"${nav}>${sectionInnerHtml(s)}</section>`;
    })
    .join("\n\n");
}

export function renderDocumentPage(doc: FullDocument, opts: { liveUrl: string }): string {
  const title = escapeHtml(doc.title);
  const live = liveClientJs({ id: doc.id, version: doc.version, status: doc.status, liveUrl: opts.liveUrl });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
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
</body>
</html>
`;
}
