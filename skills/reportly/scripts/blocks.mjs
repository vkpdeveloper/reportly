// Turns data into Reportly block html: tables and charts from CSV or JSON,
// patches, terminal output, code excerpts, checklists, logs, test results,
// images and video. Pure functions, no I/O, so they are easy to test.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ESC[c]);

function caption(title, sub) {
  if (!title && !sub) return "";
  return `<figcaption>${title ? `<strong>${esc(title)}</strong>` : ""}${sub ? `<span>${esc(sub)}</span>` : ""}</figcaption>`;
}

// ---------- CSV and JSON ----------

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF. Blank lines are skipped. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/** An array of objects (keys become columns) or of arrays (first one is the header). */
export function jsonRows(data) {
  if (!Array.isArray(data) || !data.length) throw new Error("JSON must be a non-empty array");
  if (Array.isArray(data[0])) return data.map((r) => r.map((v) => (v == null ? "" : String(v))));
  const cols = [...new Set(data.flatMap((o) => Object.keys(o ?? {})))];
  return [cols, ...data.map((o) => cols.map((c) => (o?.[c] == null ? "" : typeof o[c] === "object" ? JSON.stringify(o[c]) : String(o[c]))))];
}

// "12,400" counts as a number: thousands separators are common in pasted data.
const toNumber = (v) => {
  const t = v.trim();
  if (!/^-?(\d{1,3}(,\d{3})+|\d*)(\.\d+)?$/.test(t) || !/\d/.test(t)) return NaN;
  return Number(t.replaceAll(",", ""));
};
const isNumber = (v) => Number.isFinite(toNumber(v));

// ---------- table ----------

export function tableHtml(rows, { title, sub } = {}) {
  if (rows.length < 2) throw new Error("a table needs a header row and at least one data row");
  const [head, ...body] = rows;
  const numeric = head.map((_, j) => body.every((r) => (r[j] ?? "").trim() === "" || isNumber(r[j] ?? "")) && body.some((r) => isNumber(r[j] ?? "")));
  const cls = (j) => (numeric[j] ? ' class="num"' : "");
  const th = head.map((h, j) => `<th${cls(j)}>${esc(h)}</th>`).join("");
  const trs = body.map((r) => `<tr>${head.map((_, j) => `<td${cls(j)}>${esc(r[j] ?? "")}</td>`).join("")}</tr>`).join("\n");
  const table = `<div class="tablewrap"><table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${trs}\n</tbody>\n</table></div>`;
  if (!title && !sub) return table;
  return `<figure class="table">${caption(title, sub)}\n${table}\n</figure>`;
}

// ---------- chart ----------

const CHART_TYPES = ["line", "bar", "hbar", "stacked", "doughnut", "scatter"];
const COLOR_NAMES = ["calm", "warn", "no", "read", "dim"];

/**
 * Rows: header [label, series...], then one row per label. For scatter the
 * first column is x and each other column is a series of y values.
 * @param {string[][]} rows
 * @param {{ id: string, type?: string, title: string, sub?: string, x?: string, y?: string, target?: number, colors?: string[] }} opts
 */
export function chartHtml(rows, { id, type = "line", title, sub, x, y, target, colors = [] }) {
  if (!CHART_TYPES.includes(type)) throw new Error(`--type must be one of ${CHART_TYPES.join(", ")}`);
  if (!title) throw new Error("a chart needs --title, the finding it shows");
  if (rows.length < 2 || rows[0].length < 2) throw new Error("chart data needs a header row, a label column and at least one series column");
  for (const c of colors) if (c && !COLOR_NAMES.includes(c)) throw new Error(`colours must be among ${COLOR_NAMES.join(", ")}`);
  const [head, ...body] = rows;
  const num = (v) => (isNumber(v ?? "") ? toNumber(v) : null);
  let data = body;
  if (type === "hbar") data = [...body].sort((a, b) => (num(b[1]) ?? 0) - (num(a[1]) ?? 0));

  const series = head.slice(1).map((label, k) => {
    const j = k + 1;
    const ds = { label, data: type === "scatter" ? data.map((r) => ({ x: num(r[0]), y: num(r[j]) })) : data.map((r) => num(r[j])) };
    if (colors[k]) ds.borderColor = `@@${colors[k]}@@`;
    return ds;
  });
  if (type === "line" && series.length === 1) series[0].fill = true;
  if (target !== undefined) {
    if (!["line", "bar", "stacked"].includes(type)) throw new Error("--target works with line, bar and stacked charts");
    series.push({ label: "Target", type: "line", data: data.map(() => Number(target)), borderColor: "@@no@@", borderDash: [6, 6], pointRadius: 0, pointHoverRadius: 0, fill: false });
  }
  const datasets = type === "doughnut" ? series.slice(0, 1) : series;

  const options = {};
  const axisTitle = (text) => ({ display: "@@wide@@", text });
  if (type === "doughnut") {
    // No axes.
  } else if (type === "hbar") {
    options.indexAxis = "y";
    options.scales = { x: { beginAtZero: true, ...(y ? { title: axisTitle(y) } : {}) } };
  } else {
    options.scales = { x: {}, y: {} };
    if (type !== "scatter") options.scales.y.beginAtZero = true;
    if (type === "stacked") {
      options.scales.x.stacked = true;
      options.scales.y.stacked = true;
    }
    if (x) options.scales.x.title = axisTitle(x);
    if (y) options.scales.y.title = axisTitle(y);
    if (type === "scatter") options.interaction = { mode: "nearest", intersect: true };
  }
  const chartType = { hbar: "bar", stacked: "bar" }[type] ?? type;
  const cfg = { type: chartType, data: { ...(type === "scatter" ? {} : { labels: data.map((r) => r[0]) }), datasets }, options };
  const js = JSON.stringify(cfg, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/"@@wide@@"/g, "!narrow")
    .replace(/"@@(\w+)@@"/g, "report.colors.$1")
    .replace(/\n/g, "\n    ");
  const size = type === "doughnut" ? "chart square" : "chart";
  return `<figure class="diagram">
  ${caption(title, sub)}
  <div class="${size}"><canvas id="${esc(id)}" role="img" aria-label="${esc(title)}"></canvas></div>
</figure>
<script>
  report.chart(${JSON.stringify(id)}, function (narrow) {
    return ${js};
  });
</script>`;
}

// ---------- patch ----------

/** One collapsible patch per file in a unified diff (git diff or diff -u output). */
export function diffHtml(text, { name } = {}) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const files = [];
  let current = null;
  lines.forEach((line, i) => {
    // A file starts at "diff --git", or (plain diff -u) at a "---" line followed by "+++"
    // once the previous file has hunks. A removed "-- x" line inside a hunk is not followed by "+++".
    const plainStart = line.startsWith("--- ") && lines[i + 1]?.startsWith("+++ ") && (!current || current.hunks);
    if (!current || line.startsWith("diff --git ") || plainStart) {
      current = { path: "", lines: [], hunks: false };
      files.push(current);
    }
    if (!current.hunks && line.startsWith("+++ ")) current.path = line.slice(4).replace(/^b\//, "").split("\t")[0];
    if (line.startsWith("@@")) current.hunks = true;
    current.lines.push(line);
  });
  if (!files.some((f) => f.lines.some((l) => l.startsWith("@@")))) throw new Error("no unified diff hunks found (expected lines starting with @@)");
  const kind = (l, header) => {
    if (header) return "meta";
    if (l.startsWith("@@")) return "hunk";
    if (l.startsWith("+")) return "add";
    if (l.startsWith("-")) return "del";
    if (l.startsWith("\\")) return "meta";
    return "ctx";
  };
  return files
    .filter((f) => f.lines.some((l) => l.startsWith("@@")))
    .map((f, i, all) => {
      let header = true;
      const body = f.lines
        .map((l) => {
          if (l.startsWith("@@")) header = false;
          return `<span class="l ${kind(l, header)}">${esc(l)}</span>`;
        })
        .join("");
      const label = f.path || name || "change.patch";
      const file = all.length === 1 && name ? name : `${label.split("/").pop()}.patch`;
      const open = f.lines.length <= 80 ? " open" : "";
      return `<details class="patch"${open} data-name="${esc(file)}">
  <summary>${esc(label)}<span><button type="button" class="btn copy">Copy</button> <button type="button" class="btn dl">Download</button></span></summary>
  <pre class="diff">${body}</pre>
</details>`;
    })
    .join("\n");
}

// ---------- terminal ----------

const ANSI_COLORS = { 30: "c-dim", 90: "c-dim", 31: "c-no", 91: "c-no", 32: "c-ok", 92: "c-ok", 33: "c-mid", 93: "c-mid" };

/** ANSI-coloured output as html spans in the page palette. Other escapes are dropped. */
export function ansiToHtml(text) {
  // Carriage returns redraw a line (progress bars): keep what was drawn last.
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.split("\r").pop())
    .join("\n")
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[A-Za-ln-z]/g, "");
  let out = "";
  let color = null;
  let bold = false;
  let dim = false;
  const parts = cleaned.split(/\x1b\[([0-9;]*)m/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (!parts[i]) continue;
      const classes = [color, dim && !color ? "c-dim" : null].filter(Boolean);
      const text = esc(parts[i]);
      const styled = bold ? `<b>${text}</b>` : text;
      out += classes.length ? `<span class="${classes.join(" ")}">${styled}</span>` : styled;
      continue;
    }
    const codes = parts[i] === "" ? [0] : parts[i].split(";").map(Number);
    for (let k = 0; k < codes.length; k++) {
      const code = codes[k];
      if (code === 0) [color, bold, dim] = [null, false, false];
      else if (code === 1) bold = true;
      else if (code === 2) dim = true;
      else if (code === 22) [bold, dim] = [false, false];
      else if (code === 39) color = null;
      else if (ANSI_COLORS[code]) color = ANSI_COLORS[code];
      else if ((code >= 34 && code <= 37) || (code >= 94 && code <= 97)) color = "c-ink";
      else if (code === 38 || code === 48) k += codes[k + 1] === 5 ? 2 : 4; // 256-colour and RGB: skip their arguments
    }
  }
  return out;
}

export function termHtml(text, { cmd, lines = 400 } = {}) {
  const all = text.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  const dropped = Math.max(0, all.length - lines);
  const kept = all.slice(dropped).join("\n");
  const note = dropped ? `<span class="c-dim">… ${dropped.toLocaleString("en-US")} earlier lines not shown</span>\n` : "";
  const head = `<div class="head"><span>${cmd ? `$ ${esc(cmd)}` : "Output"}</span><button type="button" class="btn copy">Copy</button></div>`;
  return `<div class="term">${head}<pre>${note}${ansiToHtml(kept)}</pre></div>`;
}

// ---------- code excerpt ----------

/** `spec` is "path", "path:10" or "path:10-40". Returns lines, numbered from the file. */
export function parseCodeSpec(spec) {
  const m = /^(.*?)(?::(\d+)(?:-(\d+))?)?$/.exec(spec);
  const from = m[2] ? Number(m[2]) : 1;
  const to = m[3] ? Number(m[3]) : m[2] ? from : Infinity;
  if (to < from) throw new Error(`line range ${from}-${to} is backwards`);
  return { path: m[1], from, to };
}

export function codeHtml(text, { path, from = 1, to = Infinity, mark, title, sub }) {
  const all = text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  if (from > all.length) throw new Error(`${path} has only ${all.length} lines`);
  const end = Math.min(to, all.length);
  const marked = new Set();
  if (mark) {
    for (const part of String(mark).split(",")) {
      const [a, b] = part.split("-").map(Number);
      for (let n = a; n <= (b || a); n++) marked.add(n);
    }
  }
  const body = all
    .slice(from - 1, end)
    .map((line, i) => {
      const n = from + i;
      return `<span class="l${marked.has(n) ? " mark" : ""}" data-n="${n}">${esc(line)}</span>`;
    })
    .join("\n");
  const range = from === 1 && end === all.length ? "" : end === from ? `:${from}` : `:${from}-${end}`;
  const box = `<div class="code"><div class="head"><span>${esc(path + range)}</span><button type="button" class="btn copy">Copy</button></div><pre>${body}</pre></div>`;
  if (!title && !sub) return box;
  return `<figure class="table">${caption(title, sub)}\n${box}\n</figure>`;
}

// ---------- checklist and log ----------

export const CHECK_STATES = ["todo", "doing", "done", "blocked"];

export function checkHtml({ item, text, note, state = "todo" }) {
  if (!CHECK_STATES.includes(state)) throw new Error(`--state must be one of ${CHECK_STATES.join(", ")}`);
  const extra = note ? `<span>${esc(note)}</span>` : "";
  return `<div class="check" data-state="${state}" data-item="${esc(item)}"><div><strong>${esc(text)}</strong>${extra}</div></div>`;
}

/** Reads text and note back from html that checkHtml wrote, so an update can change only the state. */
export function readCheck(html) {
  const unesc = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e]);
  const text = /<strong>([\s\S]*?)<\/strong>/.exec(html);
  const note = /<\/strong><span>([\s\S]*?)<\/span>/.exec(html);
  const state = /data-state="([a-z]+)"/.exec(html);
  return { text: text ? unesc(text[1]) : undefined, note: note ? unesc(note[1]) : undefined, state: state?.[1] };
}

export const LOG_STATES = ["ok", "mid", "no"];

export function logHtml({ text, state, at = new Date() }) {
  if (state && !LOG_STATES.includes(state)) throw new Error(`--state must be one of ${LOG_STATES.join(", ")}`);
  const iso = at.toISOString();
  const attr = state ? ` data-state="${state}"` : "";
  return `<div class="log"${attr}><time datetime="${iso}">${iso.slice(11, 16)}</time><span>${esc(text)}</span></div>`;
}

// ---------- test results ----------

/** Test cases from JUnit XML (bun, vitest, jest, pytest and most CI tools can write it). */
export function parseJunit(xml) {
  const unesc = (s) =>
    s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&(lt|gt|quot|apos|amp|#(\d+));/g, (_, e, n) => (n ? String.fromCharCode(Number(n)) : { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[e]));
  const attr = (tag, name) => {
    const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
    return m ? unesc(m[1]) : "";
  };
  const cases = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  for (let m; (m = re.exec(xml)); ) {
    const tag = m[1];
    const inner = m[3] ?? "";
    const group = attr(tag, "classname");
    const name = group && !attr(tag, "name").startsWith(group) ? `${group} > ${attr(tag, "name")}` : attr(tag, "name");
    const failure = /<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/.exec(inner);
    const skipped = /<skipped\b/.test(inner);
    const message = failure ? [attr(failure[2], "message"), unesc(failure[3] ?? "").trim()].filter(Boolean).join("\n\n") : undefined;
    cases.push({ name, state: failure ? "fail" : skipped ? "skip" : "pass", message });
  }
  if (!cases.length) throw new Error("no <testcase> elements found in the JUnit file");
  return cases;
}

const TEST_STATES = { pass: "pass", passed: "pass", ok: "pass", fail: "fail", failed: "fail", error: "fail", skip: "skip", skipped: "skip", todo: "skip", pending: "skip" };

/** JSON: [{ name, state: "pass" | "fail" | "skip", message? }]. */
export function jsonTests(data) {
  if (!Array.isArray(data)) throw new Error("tests JSON must be an array of { name, state, message? }");
  return data.map((t) => {
    const state = TEST_STATES[String(t.state ?? t.status ?? "").toLowerCase()];
    if (!state) throw new Error(`test "${t.name}" has state "${t.state ?? t.status}", use pass, fail or skip`);
    return { name: String(t.name), state, message: t.message ? String(t.message) : undefined };
  });
}

export function testsHtml(cases, { title, sub } = {}) {
  const count = (s) => cases.filter((c) => c.state === s).length;
  const [pass, fail, skip] = [count("pass"), count("fail"), count("skip")];
  const n = (v) => v.toLocaleString("en-US");
  const pills = [
    `<span class="pill ok">${n(pass)} passed</span>`,
    fail ? `<span class="pill no">${n(fail)} failed</span>` : "",
    skip ? `<span class="pill skip">${n(skip)} skipped</span>` : "",
  ].join("");
  const cells = cases.map((c) => `<i class="${c.state}" title="${esc(c.name)}"></i>`).join("");
  const failures = cases
    .filter((c) => c.state === "fail")
    .slice(0, 50)
    .map((c) => `<details><summary>${esc(c.name)}</summary>${c.message ? `<pre>${esc(c.message.slice(0, 4000))}</pre>` : ""}</details>`)
    .join("\n");
  const heading = title ?? (fail ? `${n(fail)} of ${n(cases.length)} tests fail` : `All ${n(pass + skip)} tests pass`);
  return `<figure class="diagram">
  ${caption(heading, sub)}
  <div class="tests"><div class="sum">${pills}</div><div class="grid" role="img" aria-label="${esc(`${pass} passed, ${fail} failed, ${skip} skipped`)}">${cells}</div>
${failures}</div>
</figure>`;
}

// ---------- images and video ----------

/** Pixel size of a PNG, JPEG, GIF or WebP from its bytes, or null. */
export function imageSize(buf) {
  const u32be = (o) => buf.readUInt32BE(o);
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") return { width: u32be(16), height: u32be(20) };
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) return null;
      const marker = buf[o + 1];
      const len = buf.readUInt16BE(o + 2);
      // SOF0 to SOF15, except DHT (c4), JPG (c8) and DAC (cc), hold the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(o + 7), height: buf.readUInt16BE(o + 5) };
      }
      o += 2 + len;
    }
  }
  return null;
}

const sizeAttrs = (img) => (img.width && img.height ? ` width="${img.width}" height="${img.height}"` : "");

/** One image as a captioned figure, or several as a gallery. Both open in the lightbox. */
export function imagesHtml(images, { title, sub }) {
  if (images.length === 1) {
    const [img] = images;
    return `<figure class="diagram">
  ${caption(title, sub)}
  <img src="${esc(img.url)}" alt="${esc(img.alt)}"${sizeAttrs(img)} loading="lazy">
</figure>`;
  }
  const figs = images
    .map((img) => `  <figure><img src="${esc(img.url)}" alt="${esc(img.alt)}"${sizeAttrs(img)} loading="lazy"><figcaption>${esc(img.caption ?? img.alt)}</figcaption></figure>`)
    .join("\n");
  const head = title || sub ? `<p class="cap">${title ? `<strong>${esc(title)}</strong> ` : ""}${sub ? esc(sub) : ""}</p>\n` : "";
  return `${head}<div class="gallery">\n${figs}\n</div>`;
}

export function videoHtml({ url, poster, width, height, title, sub, alt }) {
  const size = width && height ? ` width="${width}" height="${height}"` : "";
  return `<figure class="diagram">
  ${caption(title, sub)}
  <video controls muted playsinline preload="metadata"${size}${poster ? ` poster="${esc(poster)}"` : ""} src="${esc(url)}" aria-label="${esc(alt ?? title ?? "Recording")}"></video>
</figure>`;
}
