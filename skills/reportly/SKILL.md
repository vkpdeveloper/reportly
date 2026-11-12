---
name: reportly
description: Use whenever the user asks for a report, findings, a proposal, research, a comparison, a plan, a summary, a UI/UX review, screen recordings, design ideas, or anything else to be published or shared as a document. Also use when the user names Reportly, HTML communication (or "stable/streaming communication"), or a live report. Creates a live Reportly document first, sends the link right away, then pushes each section, finding, or video as soon as it exists while the reader watches it update.
---

# Reportly

Reportly hosts live reports. You create the document first, give the user its link right away, then push each section or block as soon as it is ready. Anyone with the link sees new content appear within a few seconds. Nobody waits for the whole report, and the user can stop you early if the direction is wrong.

The link is the deliverable. Do not send the report as Markdown instead.

## Setup

Two environment variables:

- `REPORTLY_URL`: the server, e.g. `https://reportly.example.workers.dev` (no trailing path).
- `REPORTLY_TOKEN`: an API token, `rpt_` + 40 chars. Sign up on the Reportly site, open the Tokens page, create a token, and put it in the shell profile of every machine that runs agents. It is shown only once.

If either is missing, stop and tell the user which one to set. Never print the token.

The CLI is `scripts/reportly.mjs` next to this file (Node 18+ or Bun, no dependencies). Below, `reportly` means:

```sh
node <skill-root>/scripts/reportly.mjs
```

where `<skill-root>` is the directory containing this SKILL.md.

## Workflow

1. **Create the document with a hero** that says what is coming (what you are doing, how many items, rough time). Use `assets/hero.html` as a model.

   ```sh
   reportly create --title "Checkout flow review" --project medzimi --hero /tmp/hero.html
   # id: checkout-flow-review-k3x9q2mf8z1pab
   # url: https://.../d/checkout-flow-review-k3x9q2mf8z1pab
   ```

2. **Send the url to the user immediately**, before doing the work. One line is enough: what it is and that it fills in live.
3. **Push each piece the moment it exists**: a section when its finding is clear, a block when a video is recorded. Do not batch them up for the end.
4. **Update the hero** as the picture changes (counts, the verdict). The final hero states the answer, not the plan.
5. **Set status done** when everything is in: `reportly done ID`. Viewers stop polling. Do this last.

Readers never need to reload. Do not tell them to.

`--project` is the repo or product name in kebab-case (e.g. `medzimi`). The title is the document title and also names the id. The id never changes, even if you rename the document.

## Document model

```
document   title, project, status (live | done)
  section  key, nav, html          renders <section id="{key}" data-nav="{nav}">{html}{blocks}</section>
    block  key, html               renders in order after the section html
```

- Keys: lowercase letters, digits, hyphens, at most 64 chars, starting with a letter or digit (`checkout-phone`, `rec-03`).
- The first section is the hero: key `answer`, nav `Short answer`, no `h2`. `create --hero` sets this up.
- Every other section starts with exactly one `<h2>`. The side nav lists sections in order, numbered, labelled by `nav` or else the h2 text.
- **Blocks** are for things that arrive one at a time inside a section: each recording, each screenshot pair, each finding card. Add or replace one block without resending the section.
- Writing a section replaces only the fields you send. Sending `html` keeps its blocks.
- Limits: 1 MB per html field, 200 sections per document, 500 blocks per section.
- You write only the inner markup of sections. The server supplies the page: the `<head>`, fonts, CSS, side nav, Chart.js, Mermaid, and slider scripts. Never send `<html>`, `<head>`, `<body>`, `<style>`, `<nav>`, or `<section>` tags.

## CLI

```sh
reportly create --title T --project P [--hero FILE]
reportly list [--q TEXT] [--project P]
reportly get ID                          # sections and blocks, add --json for the html
reportly meta ID [--title T] [--project P] [--status live|done]
reportly done ID
reportly delete ID

reportly section ID KEY --file FILE [--nav N] [--before K | --after K]
reportly rm-section ID KEY
reportly block ID SECTION --file FILE    # appends, prints the generated block key
reportly block ID SECTION KEY --file FILE [--before K | --after K]   # create or replace
reportly rm-block ID SECTION KEY
reportly ops ID --file ops.json          # several changes as one update
```

- Html comes from `--file FILE`, `--file -` (stdin), or `--html STR` for one-liners. Write html to a temp file and pass `--file`: it avoids all quoting problems.
- `--before` / `--after` take a section key (for `section`) or a block key (for `block`). Without them, new items go at the end. On an existing item they move it.
- `--nav` alone updates only the nav label.
- `--json` prints the raw API response.
- Errors print `reportly: <message>` on stderr. Exit code 2 means a usage or setup problem, 1 means the server refused or could not be reached.

Batch file for `ops` (applied all at once, so viewers never see a half-done change):

```json
{ "ops": [
  { "op": "section", "key": "risks", "html": "<h2>Three risks remain</h2>...", "after": "flows" },
  { "op": "block", "section": "flows", "key": "rec-04", "html": "<figure class=\"diagram\">...</figure>" },
  { "op": "remove_block", "section": "flows", "key": "rec-04-wait" },
  { "op": "meta", "status": "done" }
] }
```

Ops: `meta` (`title?`, `project?`, `status?`), `section` (`key`, `nav?`, `html?`, `blocks?`, `before?`, `after?`), `remove_section` (`key`), `block` (`section`, `key?`, `html`, `before?`, `after?`), `remove_block` (`section`, `key`), `order` (`keys`: every section key in the new order).

### Raw HTTP

Every call takes `Authorization: Bearer $REPORTLY_TOKEN` and JSON in and out. Errors are `{"error": "..."}` with status 400, 401, 404, 409 (a write collided, send it again), or 413. Use `jq --rawfile` to put html into JSON safely:

```sh
H="Authorization: Bearer $REPORTLY_TOKEN"
API="$REPORTLY_URL/api/v1"

# create
jq -n --rawfile hero hero.html '{title: "Checkout flow review", project: "medzimi",
  sections: [{key: "answer", nav: "Short answer", html: $hero}]}' |
  curl -sS -X POST "$API/docs" -H "$H" -H "Content-Type: application/json" --data-binary @-

# create or update a section
jq -n --rawfile html flows.html '{html: $html, nav: "Flows", after: "answer"}' |
  curl -sS -X PUT "$API/docs/$ID/sections/flows" -H "$H" -H "Content-Type: application/json" --data-binary @-

# create or replace a block; POST to .../blocks (no key) appends and returns {"key": ...}
jq -n --rawfile html rec.html '{html: $html}' |
  curl -sS -X PUT "$API/docs/$ID/sections/flows/blocks/rec-01" -H "$H" -H "Content-Type: application/json" --data-binary @-

# finish
curl -sS -X PATCH "$API/docs/$ID" -H "$H" -H "Content-Type: application/json" -d '{"status":"done"}'
```

Other endpoints: `GET /docs?q=&project=`, `GET /docs/:id`, `DELETE /docs/:id`, `DELETE /docs/:id/sections/:key`, `DELETE /docs/:id/sections/:key/blocks/:blockKey`, `POST /docs/:id/ops` with `{"ops": [...]}`.

## Progressive patterns

### Recordings, one by one

Create the section once, then add one block per video as each recording finishes:

```sh
reportly section "$ID" flows --after answer --html '<h2>Checkout breaks in three places</h2>'
# record, upload, then:
reportly block "$ID" flows rec-01 --file /tmp/rec-01.html
reportly block "$ID" flows rec-02 --file /tmp/rec-02.html
```

Use stable keys (`rec-01`, `checkout-phone`) so a re-record replaces the old block instead of adding a duplicate. The h2 is a finding, so rewrite it (`reportly section "$ID" flows --file ...`) once the pattern is clear. Blocks stay.

### Placeholder, then the real thing

When a slow item has a known place, reserve it so the reader sees what is coming:

```sh
reportly block "$ID" flows rec-03 --file assets/placeholder-block.html   # "Recording now"
# ...when the video is uploaded, the same key replaces it in place:
reportly block "$ID" flows rec-03 --file /tmp/rec-03.html
```

Never leave placeholders behind: replace or remove (`rm-block`) each one before `done`.

### Several agents, one document

Only the parent creates the document and sets it done. To keep the order fixed, the parent also creates every section up front with its h2, then hands out section keys:

```sh
reportly section "$ID" phone   --html '<h2>Phone checkout</h2>'
reportly section "$ID" desktop --html '<h2>Desktop checkout</h2>'
```

Each subagent gets the id, `REPORTLY_URL`, the token from the environment, and the section keys it owns. It writes only those sections and their blocks, and never touches the hero, other sections, or the status. Each call applies fully or not at all. When two writes collide, the server answers `409` and writes nothing; the CLI retries those on its own, and raw HTTP callers should send the same request again. When all of them report back, the parent updates the hero with the verdict and runs `reportly done "$ID"`.

Chart canvas ids must be unique across the whole document. Prefix them with the section key (`phone-load-time`).

### Reading a document back

`reportly get ID --json` returns every section and block with its html. To find an earlier document: `reportly list --q checkout`. The id is the last path part of a `/d/<id>` url.

## Media

Images and videos are never uploaded to Reportly. Upload the file to a public host and use its https url in `src`.

- If the `cloudflare-r2-upload` skill is installed, use it: `zsh <r2-skill-root>/scripts/upload-file.zsh /tmp/rec-01.mp4 --key "doc/<project>/<name>-<code>.mp4"`, where `<code>` is fresh for every upload (`openssl rand -hex 4`). A changed file needs a new key because caches keep the old one.
- Otherwise use any public host the user has. Check that the url loads without auth before pushing it.
- Prefer MP4 (H.264) for video, WebP or JPEG for images, at most 2000px wide.

## Writing sections

The reader should get the story from the side nav, the h2s, and the bold figure captions alone.

### Hero (section `answer`)

```html
<div class="kicker">UI review · 13 Nov 2026</div>
<h1>Checkout flow review</h1>
<p class="lede">One or two sentences: the verdict, or while working, what is coming.</p>
<div class="verdict">
  <div><b>12</b><span>what this number counts</span></div>
  <div><b>3</b><span>what this number counts</span></div>
  <div><b>40%</b><span>what this number counts</span></div>
</div>
<div class="note"><strong>The one thing to remember.</strong> One supporting sentence.</div>
```

The kicker is the document type and date (`Research`, `Proposal`, `Plan`, `Comparison`, `UI review`). Three stat tiles. Optionally one paragraph and one `.note`.

### Other sections

- One `<h2>` first, 3 to 6 words, a noun phrase or a verdict ("Coupons break the phone flow"), never "Overview" or "Introduction".
- Use `--nav` to shorten a long h2 in the side nav.
- 4 to 10 sections, most important first.
- At most 2 short paragraphs per section around its visuals. Bullets at most 12 words.
- Every figure caption leads with the finding as a sentence in `<strong>`, then units, scope, and source in `<span>`.
- Cut throat-clearing and recaps of what the reader just saw.
- No em dashes anywhere. Use commas, colons, parentheses, or hyphens.
- Plain words: no jargon, no invented names, no model names.

### Components

| Need | Markup |
|---|---|
| Status | `<span class="pill ok">Works</span>`, `pill mid` (Limited), `pill no` (Blocked) |
| Pill key | `<div class="legend"><span class="pill ok">Works</span> meaning ...</div>` |
| Item with status | `.cards > .card` with `.top` (h3 + pill), `p`, optional `.how` (`<b>How:</b> ...`) |
| Group label inside a section | `<div class="group">Calls</div>` before a `.cards` block |
| Decision or risk | `<div class="note">`, `.note.warn`, `.note.no`. At most one per section. |
| Exact lookup | `<div class="tablewrap"><table>`; numeric columns get `class="num"` on `th` and `td` |
| Ordered plan | `.phases > .phase` with `<div class="num">01</div>` and a div of h3, p, ul |
| Open questions | `<ol class="qs"><li><strong>Topic:</strong> question?</li></ol>` |
| Small source note | `<p class="cap">` |
| Sources | `<footer>` at the end of the last section |
| Two figures side by side | `<div class="grid-2">` (one column under 720px) |
| Command | `<div class="cmd"><code>cmd</code><button type="button" class="btn" data-copy="cmd">Copy</button></div>` |
| Colour swatch | `<span class="hex">#E8A15C</span>` or `<span class="hex" data-color="#8C8C94">Name</span>` |

Card example:

```html
<div class="cards">
  <div class="card"><div class="top"><h3>Saved cards</h3><span class="pill ok">Works</span></div>
    <p>One tap pays on both phone and desktop.</p></div>
  <div class="card"><div class="top"><h3>Coupon field</h3><span class="pill no">Blocked</span></div>
    <p>Hides the pay button on phones.</p><div class="how"><b>How:</b> collapse the field after applying.</div></div>
</div>
```

### Colour means something

The page is dark grays. Colour is rare and always carries meaning:

- calm green (`ok`, `.note`, `report.colors.calm`): works, good, proposed, the main series.
- warn amber (`mid`, `.note.warn`, `report.colors.warn`): limited, caution, decisions.
- no red (`no`, `.note.no`, `report.colors.no`): blocked, bad, current state in comparisons, thresholds.

Everything else is gray. Never add styles, colours, fonts, gradients, shadows, or animations.

### Charts (Chart.js)

If numbers compare, change, rank, split, or relate, draw a chart. Use a stat tile for one headline number and a table for exact lookup. Each chart sits in a `.diagram` figure, caption first, with its script right after it in the same section or block:

```html
<figure class="diagram">
  <figcaption><strong>Checkout p95 doubled after the cache change</strong><span>ms, p95, 1 to 30 Sep, Grafana</span></figcaption>
  <div class="chart"><canvas id="perf-checkout-p95" role="img" aria-label="Checkout p95 rose from 410 to 820 ms"></canvas></div>
</figure>
<script>
  report.chart("perf-checkout-p95", function (narrow) {
    return {
      type: "line",
      data: {
        labels: ["Sep 1", "Sep 8", "Sep 15", "Sep 22", "Sep 29"],
        datasets: [
          { label: "Checkout", data: [410, 430, 690, 780, 820], fill: true },
          { label: "Target", data: [500, 500, 500, 500, 500], borderColor: report.colors.no, borderDash: [6, 6], pointRadius: 0, pointHoverRadius: 0 }
        ]
      },
      options: { scales: { y: { beginAtZero: true, title: { display: !narrow, text: "ms" } } } }
    };
  });
</script>
```

`report.chart(canvasId, build)` takes a function that gets `narrow` (true under 720px) and returns a plain Chart.js 4 config. The runtime already handles colours (series in order: calm, light gray, mid gray, warn, no), fonts, grid, legend (hidden for a single series), tooltips, and line and doughnut styling, so leave those out. Set `report.colors.warn` / `report.colors.no` explicitly when a series means limited or bad, and `report.colors.calm` for good or proposed.

| Data shape | Config |
|---|---|
| Change over time | `line`; `fill: true` on at most one series |
| Target or threshold | extra flat dataset, `borderDash: [6, 6]`, `pointRadius: 0`, coloured `no` or `warn` |
| Rank categories | `bar` with `options.indexAxis: "y"`, sorted descending |
| Compare 2 to 4 groups | grouped `bar` |
| Part to whole | stacked `bar`, or `doughnut` for 2 to 5 parts in `.chart.square` |
| Distribution | `bar` of pre-binned counts |
| Two numbers related | `scatter` with `options.interaction: { mode: "nearest", intersect: true }` |
| Mixed units | two charts in `.grid-2`, never a dual axis |

Bars start at zero. Units go in the axis title or caption. At most 4 series (start extras with `hidden: true`). No radar, 3D, or pies over 5 slices. Heights come from classes only: `.chart`, `.chart.short`, `.chart.tall`, `.chart.square`. Every canvas needs a unique id, `role="img"`, and an `aria-label` stating the finding. Scripts in sections run when the section first appears and again when it changes, so only call `report.chart`; do not wait for page load events.

### Flowcharts (Mermaid)

Any process, request path, lifecycle, or decision is a flowchart in a `.diagram` figure. Use `sequenceDiagram` for messages between actors and `stateDiagram-v2` for state machines.

```html
<figure class="diagram">
  <figcaption><strong>Every deploy passes two gates</strong><span>Release pipeline, Oct 2026</span></figcaption>
  <pre class="mermaid">
flowchart LR
  push([Push]) --> tests{Tests pass?}
  tests ==>|yes| canary[Canary 5%]
  tests -->|no| fix[Fix]
  fix -.-> push
  canary ==> live([Live])
  classDef start fill:#18181b,stroke:#ededee,stroke-width:1.5px,color:#ededee
  classDef step fill:#18181b,stroke:#2e2e33,stroke-width:1.5px,color:#ededee
  classDef decide fill:#1e1b14,stroke:#e8c27a,stroke-width:1.5px,color:#ededee
  classDef good fill:#141d1a,stroke:#8fd4b6,stroke-width:1.5px,color:#ededee
  classDef bad fill:#1e1717,stroke:#e89a9a,stroke-width:1.5px,color:#ededee
  class push start
  class canary,fix step
  class tests decide
  class live good
  </pre>
</figure>
```

- Paste the five `classDef` lines and give every node a class. Most nodes are `step`. Colour only the entry (`start`), decisions (`decide`), and outcomes (`good`, `bad`).
- Shapes: `([start/end])`, `[step]`, `{decision?}`, `[(store)]`, `[[subsystem]]`. Edges: `-->` normal, `==>` main path, `-.->` retry or async.
- At most 10 nodes, node labels at most 3 words, edge labels 1 or 2 words, at most 5 ranks.
- Write `flowchart LR`. The page flips it top to bottom on phones and when it would be too small. Do not initialise Mermaid yourself.

### Current vs proposed slider

For any visual change, use the slider. Two hosted images of identical size, current first. Say so if the proposed image is simulated.

```html
<div class="cmp">
  <img src="https://assets.example.com/doc/medzimi/checkout-current.webp" alt="Current: coupon field open, pay button hidden" width="2000" height="1125">
  <img class="after" src="https://assets.example.com/doc/medzimi/checkout-proposed.webp" alt="Proposed: coupon collapses, pay button visible" width="2000" height="1125">
  <div class="divider"></div>
  <div class="knob" aria-hidden="true">&#x21D4;</div>
  <span class="lbl b">Current</span><span class="lbl a">Proposed</span>
  <input type="range" min="0" max="100" value="50" aria-label="Compare current and proposed">
</div>
```

Follow it with `.cards` of findings and, when the fix is code, a patch (HTML-escape the diff text):

```html
<details class="patch" data-name="fix-coupon.patch">
  <summary>fix-coupon.patch<span><button type="button" class="btn copy">Copy</button> <button type="button" class="btn dl">Download</button></span></summary>
  <pre class="diff"><span class="l meta">--- a/checkout.css</span><span class="l hunk">@@ -1,2 +1,2 @@</span><span class="l ctx"> .coupon {</span><span class="l del">-  display: block;</span><span class="l add">+  display: none;</span></pre>
</details>
```

### Video

One recording per `.diagram` figure, caption leading with what the video proves. See `assets/video-block.html`:

```html
<figure class="diagram">
  <figcaption><strong>Coupon field pushes the pay button out of view</strong><span>Checkout, desktop 1440px, recorded 13 Nov 2026</span></figcaption>
  <video controls muted playsinline preload="metadata" width="1440" height="900" style="display:block;width:100%;height:auto;border-radius:10px"
    poster="https://.../checkout-coupon-desktop.jpg" src="https://.../checkout-coupon-desktop.mp4"
    aria-label="Opening the coupon field pushes the pay button below the fold"></video>
  <p class="cap"><span class="pill no">Blocked</span> The pay button is only reachable after closing the coupon field.</p>
</figure>
```

- Always `controls muted playsinline preload="metadata"`, real `width` and `height`, and a poster frame. No `autoplay` or `loop`.
- Put portrait phone recordings two at a time in a `<div class="grid-2">` so they stay a readable size.
- A video that is playing keeps playing when other parts of the document update.

## Before calling it done

- Every placeholder is replaced or removed, and the hero states the final verdict.
- Every media url loads publicly.
- `reportly get ID` shows the sections in the intended order.
- `reportly done ID` ran, and the user has the url.
