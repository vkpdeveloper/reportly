# Reportly API

Base URL: `https://reportly.<account>.workers.dev` (set as `REPORTLY_URL`).

All `/api/v1` calls need `Authorization: Bearer <token>`. Tokens look like `rpt_` + 40 chars and are created in the dashboard (Tokens page). A token only sees documents owned by its user. Anything owned by someone else returns `404`, same as a missing document.

Responses are JSON. Errors: `{"error": "<message>"}` with status 400 (bad input), 401 (missing or bad token), 404, 413 (too large). Every response has `Cache-Control: no-store`.

## Model

A **document** has `title`, `project`, `status` (`live` or `done`) and an ordered list of **sections**.

A **section** has a `key` (its anchor id, `^[a-z0-9][a-z0-9-]{0,63}$`), an optional `nav` label, `html`, and an ordered list of **blocks**. It renders as:

```html
<section id="{key}" data-nav="{nav}">{html}{block 1 html}{block 2 html}...</section>
```

`html` and block `html` use the html-communication template markup (`.kicker`, `h1`, `.lede`, `.verdict`, `h2`, `.cards`, `.diagram`, `report.chart(...)` scripts, `.cmp` sliders, `<video>`, ...). The first section is the hero, conventionally `key: "answer"`, `nav: "Short answer"`, with no `h2`. Every other section starts with one `h2`.

A **block** has a `key` (`^[a-z0-9][a-z0-9-]{0,63}$`) and `html`. Use blocks for things that arrive one at a time, such as recordings: add a block per video as each finishes, or replace a placeholder block when its video lands.

Limits: 1 MB per html field, 200 sections per document, 500 blocks per section. Media is never uploaded to Reportly: put files on R2 (or any public host) and reference the URL.

Every write bumps the document `version` by exactly 1 and updates `updated_at`. Open viewers pick up changes within a few seconds.

## Endpoints

### Create a document

`POST /api/v1/docs`

```json
{
  "title": "Checkout redesign",
  "project": "medzimi",
  "sections": [
    { "key": "answer", "nav": "Short answer", "html": "<p class=\"kicker\">Proposal · 13 Nov 2026</p><h1>Checkout redesign</h1><p class=\"lede\">Recording flows now.</p>" }
  ]
}
```

`sections` is optional (each item: `key`, `nav?`, `html?`, `blocks?: [{key, html}]`). Returns `201`:

```json
{ "id": "checkout-redesign-k3x9q2mf8z1pab", "url": "https://.../d/checkout-redesign-k3x9q2mf8z1pab", "version": 1 }
```

### List documents

`GET /api/v1/docs?q=checkout&project=medzimi` → `{ "documents": [DocumentSummary] }`, newest update first. `q` matches title or project.

`DocumentSummary`: `{ id, url, title, project, status, version, createdAt, updatedAt }` (timestamps in unix ms).

### Get a document

`GET /api/v1/docs/:id` → `DocumentSummary` plus `sections: [{ key, nav, html, rev, blocks: [{ key, html }] }]`.

### Update metadata

`PATCH /api/v1/docs/:id` with any of `{ "title", "project", "status" }` → `{ id, url, version }`. Set `status: "done"` when the agent has finished; viewers stop polling. The id never changes, even if the title does.

### Delete a document

`DELETE /api/v1/docs/:id` → `{ "deleted": true }`.

### Upsert a section

`PUT /api/v1/docs/:id/sections/:key` with `{ "html"?, "nav"?, "blocks"?, "before"?, "after"? }`.

- New key: created at the end, or `before` / `after` another section key.
- Existing key: fields given are replaced, fields omitted are kept. `blocks` (if given) replaces all blocks of the section. `before` / `after` moves it.

Returns `{ id, url, version }`.

### Delete a section

`DELETE /api/v1/docs/:id/sections/:key` → `{ id, url, version }`.

### Upsert a block

`PUT /api/v1/docs/:id/sections/:key/blocks/:blockKey` with `{ "html", "before"?, "after"? }`. The section must exist. New blocks go at the end (or `before` / `after` a block key); existing blocks are replaced in place (or moved). Returns `{ id, url, version }`.

`POST /api/v1/docs/:id/sections/:key/blocks` with `{ "html" }` appends a block with a generated key and returns `{ id, url, version, key }`.

### Delete a block

`DELETE /api/v1/docs/:id/sections/:key/blocks/:blockKey` → `{ id, url, version }`.

### Batch operations

`POST /api/v1/docs/:id/ops` with `{ "ops": [Op, ...] }` applies all ops atomically as one version bump. Every endpoint above is sugar over these ops:

| Op | Fields |
|---|---|
| `{"op": "meta"}` | `title?`, `project?`, `status?` |
| `{"op": "section"}` | `key`, `nav?`, `html?`, `blocks?`, `before?`, `after?` |
| `{"op": "remove_section"}` | `key` |
| `{"op": "block"}` | `section`, `key?` (generated if missing), `html`, `before?`, `after?` |
| `{"op": "remove_block"}` | `section`, `key` |
| `{"op": "order"}` | `keys`: every section key in the new order |

Returns `{ id, url, version, keys?: string[] }` where `keys` lists generated block keys in op order.

## Public endpoints (no token)

### Viewer

`GET /d/:id` renders the full document page with the template. Unknown ids return 404. Response headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and `Content-Security-Policy: sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals` so document scripts run in an opaque origin and can never act as the logged-in dashboard user.

### Live updates

`GET /api/live/:id?since=<version>` with `Access-Control-Allow-Origin: *`.

- Unchanged (`version == since`): `{ "version": 7, "status": "live" }`.
- Changed: `{ "version": 9, "status": "live", "title": "...", "sections": [{ "key", "nav", "rev", "html"? }] }`. `sections` is the full ordered list. `html` is the fully rendered inner html (section html + blocks) and is present only when `rev > since`. Keys missing from the list were deleted.
- Unknown id: 404.

The viewer polls every 3 s while the tab is visible and `status` is `live`, pauses while hidden, and stops once `status` is `done`.
