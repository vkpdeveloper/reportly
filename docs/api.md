# Reportly API

Base URL: your own deployment, for example `https://reportly.<your-subdomain>.workers.dev` (set as `REPORTLY_URL`).

All `/api/v1` calls need `Authorization: Bearer <token>`. Tokens look like `rpt_` + 40 chars and are created in the dashboard (Tokens page). A token only sees documents owned by its user. Anything owned by someone else returns `404`, same as a missing document.

Responses are JSON. Errors: `{"error": "<message>"}` with status 400 (bad input, including unknown fields or an unknown section or block), 401 (missing or bad token), 404 (document missing or not yours), 409 (another writer changed the document at the same moment; nothing was written, retry), 413 (too large), 415 (file type not allowed), 429 (too many comments). Every response has `Cache-Control: no-store`.

## Model

A **document** has `title`, `project`, `status` (`live` or `done`) and an ordered list of **sections**.

A **section** has a `key` (its anchor id, `^[a-z0-9][a-z0-9-]{0,63}$`), an optional `nav` label, `html`, and an ordered list of **blocks**. It renders as:

```html
<section id="{key}" data-nav="{nav}">{html}{block 1 html}{block 2 html}...</section>
```

`html` and block `html` use the Reportly template markup (`.kicker`, `h1`, `.lede`, `.verdict`, `h2`, `.cards`, `.diagram`, `report.chart(...)` scripts, `.cmp` sliders, `<video>`, ...). The first section is the hero, conventionally `key: "answer"`, `nav: "Short answer"`, with no `h2`. Every other section starts with one `h2`.

A **block** has a `key` (`^[a-z0-9][a-z0-9-]{0,63}$`) and `html`. Use blocks for things that arrive one at a time, such as recordings: add a block per video as each finishes, or replace a placeholder block when its video lands.

Limits: 1 MB per html field, 200 sections per document, 500 blocks per section. A section with no html and no blocks renders as pending ("Pending" on the page and in the nav). Media goes through the media endpoint below and is stored in the server's own R2 bucket.

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

### Upload media

`POST /api/v1/docs/:id/media?name=rec-01.mp4` with the raw file as the body and a `Content-Length`. The type comes from the extension: png, jpg, jpeg, webp, gif, avif, svg, mp4, m4v, webm, mov, mp3, m4a, wav, ogg, pdf. Up to 100 MB. Returns `201`:

```json
{ "id": "q8w2e4r6t1y3u5i7o9p0", "name": "rec-01.mp4", "contentType": "video/mp4", "size": 1650000, "url": "https://.../m/q8w2e4r6t1y3u5i7o9p0/rec-01.mp4" }
```

Errors: 411 (no body or no `Content-Length`), 413 (over 100 MB), 415 (type not allowed). Files are deleted with their document. Uploading does not change the document; put the `url` into html yourself.

### Comments

`Comment`: `{ id, section, item, author, body, fromAgent, createdAt }`. `item` is the `data-item` key inside the section, or `null` for the section heading. `createdAt` is unix ms.

- `GET /api/v1/docs/:id/comments?since=<ms>` → `{ "comments": [Comment] }`, oldest first, only those created after `since` (default 0).
- `POST /api/v1/docs/:id/comments` with `{ "section", "item"?, "body", "author"? }` → `201 { "comment": Comment }`, posted as the agent (`fromAgent: true`, author defaults to `"Agent"`). `body` is 1 to 2000 characters. 404 if the section does not exist.
- `DELETE /api/v1/docs/:id/comments/:commentId` → `{ "deleted": true }`.

## Public endpoints (no token)

### Viewer

`GET /d/:id` renders the full document page with the template. Unknown ids return 404. Response headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and `Content-Security-Policy: sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals` so document scripts run in an opaque origin and can never act as the logged-in dashboard user.

### Live updates

`GET /api/live/:id?since=<version>` with `Access-Control-Allow-Origin: *`.

- Unchanged (`version == since`): `{ "version": 7, "status": "live", "updatedAt": 1763042520000, "comments": 3 }`.
- Changed: the same fields plus `"title"` and `"sections": [{ "key", "nav", "rev", "html"? }]`. `sections` is the full ordered list. `html` is the fully rendered inner html (section html + blocks) and is present only when `rev > since`; an empty string means the section is pending. Keys missing from the list were deleted.
- `comments` is the document's comment count. The viewer refetches the comments when it changes.
- Unknown id: 404.

The viewer polls every 3 s while the tab is visible and `status` is `live`, pauses while hidden, and stops once `status` is `done`.

### Reader comments

`GET /api/live/:id/comments` → `{ "comments": [Comment] }`. `POST /api/live/:id/comments` with `{ "section", "item"?, "body", "author"? }` → `201 { "comment": Comment }` (`fromAgent: false`, author defaults to `"Reader"`). Both send `Access-Control-Allow-Origin: *`, because the sandboxed viewer has an opaque origin. Up to 500 comments per document, then 429.

### Media files

`GET /m/:mediaId/:name` (and `HEAD`) serves an uploaded file from R2 with `Content-Length`, `ETag`, `Accept-Ranges: bytes` and `206` range responses, so videos can seek. Headers: `Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex, nofollow`. Files of deleted documents return 404.
