#!/usr/bin/env node
// Reportly CLI: create a live document, then push sections and blocks to it.
// Zero dependencies, Node 18+ or Bun. Reads REPORTLY_URL and REPORTLY_TOKEN.
// The API contract lives in docs/api.md of the Reportly repo.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import * as blocks from "./blocks.mjs";

const HELP = `reportly: push live documents to Reportly

Usage: reportly <command> [args] [--json]

Documents
  create --title T --project P [--hero FILE]   Create a doc, print its id and url.
                                               The hero file becomes section "answer"
                                               with nav "Short answer".
  list [--q Q] [--project P]                   List your docs, newest update first.
  get ID                                       Show a doc and its sections and blocks.
  meta ID [--title T] [--project P] [--status live|done]
  done ID                                      Same as meta ID --status done.
  delete ID                                    Delete a doc for good.

Sections and blocks (html from --file FILE, --file - for stdin, or --html STR)
  section ID KEY [--file FILE | --html STR] [--nav N] [--before K] [--after K]
                                               Create or update a section.
  rm-section ID KEY
  block ID SECTION [KEY] [--file FILE | --html STR] [--before K] [--after K]
                                               Create or replace a block. Without KEY
                                               it appends one and prints the new key.
  rm-block ID SECTION KEY
  ops ID --file ops.json                       Apply a batch of ops as one version.
                                               The file holds {"ops": [...]} or [...].

Live progress
  plan ID KEY=LABEL [KEY=LABEL ...]            Add the sections you plan to write. They
                                               show as pending in the nav until filled.
  check ID SECTION ITEM [--text T] [--state todo|doing|done|blocked] [--note N]
                                               Create or update one checklist item. Later
                                               calls can pass only --state.
  log ID SECTION TEXT [--state ok|mid|no]      Append a timestamped activity log entry.

Media (stored on your Reportly server; never use another host)
  upload ID FILE                               Upload a file and print its url. Images,
                                               video, audio and PDF, up to 100 MB.
  image ID SECTION [KEY] --file F [--file F ...] [--title T] [--sub S] [--alt A ...]
                                               Upload and add as a figure, or a gallery
                                               for several files. Click to zoom.
  video ID SECTION [KEY] --file F [--poster P] [--title T] [--sub S] [--alt A]
                                               Upload and add a video. Size and poster
                                               come from ffprobe and ffmpeg when present.

Blocks from data (each adds a block; --print writes the html to stdout instead)
  table ID SECTION [KEY] --csv F | --json F [--title T] [--sub S]
  chart ID SECTION [KEY] --csv F --title T [--type line|bar|hbar|stacked|doughnut|scatter]
        [--sub S] [--x LABEL] [--y LABEL] [--target N] [--colors calm,no,...]
                                               First CSV column is the labels (x for
                                               scatter), every other column a series.
  diff ID SECTION [KEY] --file x.patch [--name N]   Unified diff, one patch per file.
  term ID SECTION [KEY] --file out.txt [--cmd C] [--lines N]
                                               Terminal output, ANSI colours kept.
  code ID SECTION [KEY] --src PATH[:FROM[-TO]] [--mark 12-14] [--title T] [--sub S]
  tests ID SECTION [KEY] --junit F | --json F [--title T] [--sub S]

Comments (readers comment on sections and checklist items)
  comments ID [--since MS]                     List comments, oldest first.
  comment ID SECTION [ITEM] --text T           Answer as the agent.
  rm-comment ID COMMENT_ID

Options
  --json      Print the raw API response as JSON.
  --file -    Read html (or ops json) from stdin.
  help        Show this help.

Environment
  REPORTLY_URL     Base url, e.g. https://reportly.example.workers.dev
  REPORTLY_TOKEN   API token (rpt_...), created on the Tokens page of the dashboard.
`;

const VALUE_FLAGS = new Set([
  ...["title", "project", "hero", "q", "status", "file", "html", "nav", "before", "after"],
  ...["text", "state", "note", "sub", "alt", "poster", "csv", "type", "x", "y", "target", "colors"],
  ...["name", "cmd", "lines", "src", "mark", "junit", "since"],
]);
// These may be given more than once; every value is kept in flags.all[name].
const REPEAT_FLAGS = new Set(["file", "alt"]);
const BOOL_FLAGS = new Set(["json", "help", "print"]);

class UsageError extends Error {}
class ApiError extends Error {}

function parseArgs(argv) {
  const positional = [];
  const flags = { all: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--") || arg === "--") {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (BOOL_FLAGS.has(name)) {
      flags[name] = true;
    } else if (VALUE_FLAGS.has(name)) {
      const value = eq === -1 ? argv[++i] : arg.slice(eq + 1);
      if (value === undefined) throw new UsageError(`--${name} needs a value`);
      if (flags[name] !== undefined && !REPEAT_FLAGS.has(name)) throw new UsageError(`--${name} was given twice`);
      flags[name] = value;
      (flags.all[name] ??= []).push(value);
    } else {
      throw new UsageError(`unknown option --${name}`);
    }
  }
  return { positional, flags };
}

// Stdin is read only on request (--file -). Agent shells often leave stdin as an
// open pipe that never closes, so reading it implicitly could hang forever.
function readStdin() {
  return readFileSync(0, "utf8");
}

function readFile(path) {
  if (path === "-") return readStdin();
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    throw new UsageError(`cannot read ${path}: ${err.code === "ENOENT" ? "no such file" : err.message}`);
  }
}

/** Html from --html or --file (FILE, or - for stdin). Undefined when neither was given. */
function readHtml(flags) {
  if (flags.html !== undefined && flags.file !== undefined) throw new UsageError("pass --html or --file, not both");
  if (flags.html !== undefined) return flags.html;
  if (flags.file !== undefined) return readFile(flags.file);
  return undefined;
}

function requireHtml(flags) {
  const html = readHtml(flags);
  if (html === undefined) throw new UsageError("no html: pass --file FILE, --file - (stdin), or --html STR");
  return html;
}

function need(positional, count, usage) {
  if (positional.length < count) throw new UsageError(`usage: reportly ${usage}`);
  if (positional.length > count) throw new UsageError(`unexpected argument "${positional[count]}"\nusage: reportly ${usage}`);
  return positional;
}

function config() {
  const base = process.env.REPORTLY_URL;
  const token = process.env.REPORTLY_TOKEN;
  if (!base) throw new UsageError("REPORTLY_URL is not set. Export the base url of your Reportly server, e.g. https://reportly.example.workers.dev");
  if (!token) throw new UsageError("REPORTLY_TOKEN is not set. Create a token on the Tokens page of the Reportly dashboard and export it.");
  return { base: base.replace(/\/+$/, ""), token };
}

const seg = encodeURIComponent;

// A 409 means another writer changed the document at the same moment and
// nothing was written, so the same request is always safe to send again.
const CONFLICT_RETRIES = 4;

/** `body` is sent as JSON, or as raw bytes when it is a Buffer (uploads). */
async function api(method, path, body) {
  const { base, token } = config();
  const url = `${base}/api/v1${path}`;
  const raw = Buffer.isBuffer(body);
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": raw ? "application/octet-stream" : "application/json" }),
        },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      });
    } catch (err) {
      throw new ApiError(`cannot reach ${base}: ${err.cause?.message ?? err.message}`);
    }
    if (res.status !== 409 || attempt === CONFLICT_RETRIES) break;
    await res.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt + Math.random() * 200));
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(`HTTP ${res.status} from ${method} ${path}, not JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new ApiError(`${data.error ?? "request failed"} (HTTP ${res.status})`);
  return data;
}

/** Drop undefined fields so the API keeps whatever we did not mention. */
function defined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function date(ms) {
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

function printList({ documents }) {
  if (!documents.length) return console.log("no documents");
  for (const d of documents) {
    console.log([date(d.updatedAt), d.status.padEnd(4), d.project, d.title, d.url].join("  "));
  }
}

function printDoc(doc) {
  console.log(`${doc.title}  (${doc.project}, ${doc.status}, version ${doc.version})`);
  console.log(doc.url);
  for (const s of doc.sections) {
    const nav = s.nav ? `  "${s.nav}"` : "";
    console.log(`  ${s.key}${nav}  ${s.html.length} chars`);
    for (const b of s.blocks) console.log(`    - ${b.key}  ${b.html.length} chars`);
  }
}

function printWrite(res) {
  console.log(`version ${res.version}  ${res.url}`);
}

function printComments({ comments }) {
  if (!comments.length) return console.log("no comments");
  for (const c of comments) {
    const where = c.item ? `${c.section}/${c.item}` : c.section;
    const who = c.fromAgent ? `${c.author} (agent)` : c.author;
    console.log(`${date(c.createdAt)}  ${where}  ${who}: ${c.body.replace(/\n/g, "\n    ")}  [${c.id}]`);
  }
}

/** Create or replace block KEY, or append one when KEY is undefined. Prints the key. */
async function pushBlock(id, section, key, html, flags, out) {
  const base = `/docs/${seg(id)}/sections/${seg(section)}/blocks`;
  if (key !== undefined) {
    const res = await api("PUT", `${base}/${seg(key)}`, defined({ html, before: flags.before, after: flags.after }));
    return out(res, () => console.log(key));
  }
  if (flags.before === undefined && flags.after === undefined) {
    return out(await api("POST", base, { html }), (r) => console.log(r.key));
  }
  // The append endpoint takes no position, so a positioned keyless block goes through ops.
  const op = defined({ op: "block", section, html, before: flags.before, after: flags.after });
  const res = await api("POST", `/docs/${seg(id)}/ops`, { ops: [op] });
  return out(res, (r) => console.log(r.keys?.[0] ?? ""));
}

async function upload(id, path) {
  let bytes;
  try {
    if (statSync(path).size > 100 * 1024 * 1024) throw new UsageError(`${path} is larger than 100 MB`);
    bytes = readFileSync(path);
  } catch (err) {
    if (err instanceof UsageError) throw err;
    throw new UsageError(`cannot read ${path}: ${err.code === "ENOENT" ? "no such file" : err.message}`);
  }
  const file = await api("POST", `/docs/${seg(id)}/media?name=${encodeURIComponent(basename(path))}`, bytes);
  return { file, bytes };
}

function readJson(path) {
  try {
    return JSON.parse(readFile(path));
  } catch (err) {
    if (err instanceof UsageError) throw err;
    throw new UsageError(`${path} is not valid JSON: ${err.message}`);
  }
}

/** Runs a tool such as ffprobe if it is installed. Returns its stdout, or null. */
function tool(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

const altFromName = (path) => basename(path).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");

// Data helpers share one shape: ID SECTION [KEY], and --print to skip pushing.
async function dataBlock(command, args, flags, out, build) {
  const usage = `${command} ID SECTION [KEY] ...`;
  if (!flags.print && (args.length < 2 || args.length > 3)) throw new UsageError(`usage: reportly ${usage}`);
  const [id, section, key] = args;
  const html = build({ id, section, key });
  if (flags.print) return process.stdout.write(`${html}\n`);
  return pushBlock(id, section, key, html, flags, out);
}

/** Wraps builder errors (bad csv, unknown chart type) as usage errors. */
function usage(fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof UsageError || err instanceof ApiError) throw err;
    throw new UsageError(err.message);
  }
}

async function run(argv) {
  const { positional, flags } = parseArgs(argv);
  const [command, ...args] = positional;
  const json = flags.json === true;
  const out = (res, human) => (json ? console.log(JSON.stringify(res, null, 2)) : human(res));

  if (!command || command === "help" || flags.help) {
    process.stdout.write(HELP);
    return;
  }

  switch (command) {
    case "create": {
      need(args, 0, "create --title T --project P [--hero FILE]");
      if (!flags.title) throw new UsageError("create needs --title");
      if (!flags.project) throw new UsageError("create needs --project");
      const sections = flags.hero === undefined ? undefined : [{ key: "answer", nav: "Short answer", html: readFile(flags.hero) }];
      const res = await api("POST", "/docs", defined({ title: flags.title, project: flags.project, sections }));
      return out(res, (r) => console.log(`id: ${r.id}\nurl: ${r.url}`));
    }
    case "list": {
      need(args, 0, "list [--q Q] [--project P]");
      const query = new URLSearchParams(defined({ q: flags.q, project: flags.project })).toString();
      const res = await api("GET", `/docs${query ? `?${query}` : ""}`);
      return out(res, printList);
    }
    case "get": {
      const [id] = need(args, 1, "get ID");
      return out(await api("GET", `/docs/${seg(id)}`), printDoc);
    }
    case "meta": {
      const [id] = need(args, 1, "meta ID [--title T] [--project P] [--status live|done]");
      if (flags.status !== undefined && flags.status !== "live" && flags.status !== "done") {
        throw new UsageError("--status must be live or done");
      }
      const body = defined({ title: flags.title, project: flags.project, status: flags.status });
      if (!Object.keys(body).length) throw new UsageError("meta needs at least one of --title, --project, --status");
      return out(await api("PATCH", `/docs/${seg(id)}`, body), printWrite);
    }
    case "done": {
      const [id] = need(args, 1, "done ID");
      return out(await api("PATCH", `/docs/${seg(id)}`, { status: "done" }), printWrite);
    }
    case "delete": {
      const [id] = need(args, 1, "delete ID");
      const res = await api("DELETE", `/docs/${seg(id)}`);
      return out(res, () => console.log(`deleted ${id}`));
    }
    case "section": {
      const [id, key] = need(args, 2, "section ID KEY [--file FILE | --html STR] [--nav N] [--before K] [--after K]");
      const body = defined({ html: readHtml(flags), nav: flags.nav, before: flags.before, after: flags.after });
      return out(await api("PUT", `/docs/${seg(id)}/sections/${seg(key)}`, body), printWrite);
    }
    case "rm-section": {
      const [id, key] = need(args, 2, "rm-section ID KEY");
      return out(await api("DELETE", `/docs/${seg(id)}/sections/${seg(key)}`), printWrite);
    }
    case "block": {
      if (args.length < 2 || args.length > 3) {
        throw new UsageError("usage: reportly block ID SECTION [KEY] [--file FILE | --html STR] [--before K] [--after K]");
      }
      const [id, section, key] = args;
      const html = requireHtml(flags);
      if (key !== undefined) {
        const base = `/docs/${seg(id)}/sections/${seg(section)}/blocks`;
        return out(await api("PUT", `${base}/${seg(key)}`, defined({ html, before: flags.before, after: flags.after })), printWrite);
      }
      return pushBlock(id, section, key, html, flags, out);
    }
    case "plan": {
      const [id, ...entries] = args;
      if (!id || !entries.length) throw new UsageError("usage: reportly plan ID KEY=LABEL [KEY=LABEL ...]");
      const ops = entries.map((entry) => {
        const eq = entry.indexOf("=");
        if (eq < 1) throw new UsageError(`"${entry}" should look like risks="Three risks remain"`);
        return { op: "section", key: entry.slice(0, eq), nav: entry.slice(eq + 1) };
      });
      return out(await api("POST", `/docs/${seg(id)}/ops`, { ops }), printWrite);
    }
    case "check": {
      const [id, section, item] = need(args, 3, "check ID SECTION ITEM [--text T] [--state todo|doing|done|blocked] [--note N]");
      let { text, note, state } = flags;
      if (text === undefined || (note === undefined && state === undefined)) {
        // Fill what was left out from the item as it is now.
        const doc = await api("GET", `/docs/${seg(id)}`);
        const block = doc.sections.find((s) => s.key === section)?.blocks.find((b) => b.key === item);
        const now = block ? blocks.readCheck(block.html) : {};
        text ??= now.text;
        if (flags.note === undefined) note = now.note;
        state ??= now.state;
      }
      if (text === undefined) throw new UsageError(`item "${item}" does not exist yet, so pass --text`);
      const html = usage(() => blocks.checkHtml({ item, text, note: note || undefined, state }));
      const res = await api("PUT", `/docs/${seg(id)}/sections/${seg(section)}/blocks/${seg(item)}`, defined({ html, before: flags.before, after: flags.after }));
      return out(res, printWrite);
    }
    case "log": {
      const [id, section, ...words] = args;
      if (!id || !section || !words.length) throw new UsageError("usage: reportly log ID SECTION TEXT [--state ok|mid|no]");
      const html = usage(() => blocks.logHtml({ text: words.join(" "), state: flags.state }));
      return pushBlock(id, section, undefined, html, flags, out);
    }
    case "upload": {
      const [id, path] = need(args, 2, "upload ID FILE");
      const { file } = await upload(id, path);
      return out(file, (r) => console.log(r.url));
    }
    case "image": {
      if (args.length < 2 || args.length > 3) throw new UsageError("usage: reportly image ID SECTION [KEY] --file F [--file F ...] [--title T] [--sub S] [--alt A ...]");
      const [id, section, key] = args;
      const files = flags.all.file ?? [];
      if (!files.length) throw new UsageError("image needs --file (once per image)");
      const alts = flags.all.alt ?? [];
      const images = [];
      for (const [i, path] of files.entries()) {
        const { file, bytes } = await upload(id, path);
        const size = blocks.imageSize(bytes);
        const alt = alts[i] ?? (files.length === 1 ? flags.title : undefined) ?? altFromName(path);
        images.push({ url: file.url, alt, ...(size ?? {}) });
      }
      const html = blocks.imagesHtml(images, { title: flags.title, sub: flags.sub });
      if (flags.print) return process.stdout.write(`${html}\n`);
      return pushBlock(id, section, key, html, flags, out);
    }
    case "video": {
      if (args.length < 2 || args.length > 3) throw new UsageError("usage: reportly video ID SECTION [KEY] --file F [--poster P] [--title T] [--sub S] [--alt A]");
      const [id, section, key] = args;
      if (!flags.file) throw new UsageError("video needs --file");
      const probed = tool("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", flags.file]);
      const [width, height] = (probed ?? "").split("x").map(Number);
      let poster = flags.poster;
      let dir;
      if (!poster) {
        dir = mkdtempSync(join(tmpdir(), "reportly-"));
        const frame = join(dir, `${basename(flags.file).replace(/\.[^.]+$/, "")}-poster.jpg`);
        if (tool("ffmpeg", ["-v", "error", "-y", "-ss", "0.5", "-i", flags.file, "-frames:v", "1", "-q:v", "3", frame]) !== null) poster = frame;
      }
      try {
        const posterUrl = poster ? (await upload(id, poster)).file.url : undefined;
        const { file: video } = await upload(id, flags.file);
        const html = blocks.videoHtml({ url: video.url, poster: posterUrl, width, height, title: flags.title, sub: flags.sub, alt: flags.alt });
        if (flags.print) return process.stdout.write(`${html}\n`);
        return await pushBlock(id, section, key, html, flags, out);
      } finally {
        if (dir) rmSync(dir, { recursive: true, force: true });
      }
    }
    case "table": {
      return dataBlock(command, args, flags, out, () => {
        if ((flags.csv === undefined) === (flags.json === undefined)) throw new UsageError("table needs --csv FILE or --json FILE");
        const rows = usage(() => (flags.csv !== undefined ? blocks.parseCsv(readFile(flags.csv)) : blocks.jsonRows(readJson(flags.json))));
        return usage(() => blocks.tableHtml(rows, { title: flags.title, sub: flags.sub }));
      });
    }
    case "chart": {
      return dataBlock(command, args, flags, out, ({ section, key }) => {
        if (flags.csv === undefined) throw new UsageError("chart needs --csv FILE");
        const rows = usage(() => blocks.parseCsv(readFile(flags.csv)));
        // Canvas ids must be unique in the whole document, so they start with the section key.
        const canvas = `${section ?? "chart"}-${key ?? `chart-${Math.random().toString(36).slice(2, 8)}`}`;
        const colors = flags.colors ? flags.colors.split(",").map((c) => c.trim()) : [];
        const target = flags.target === undefined ? undefined : Number(flags.target);
        if (target !== undefined && !Number.isFinite(target)) throw new UsageError("--target must be a number");
        return usage(() => blocks.chartHtml(rows, { id: canvas, type: flags.type, title: flags.title, sub: flags.sub, x: flags.x, y: flags.y, target, colors }));
      });
    }
    case "diff": {
      return dataBlock(command, args, flags, out, () => {
        if (flags.file === undefined) throw new UsageError("diff needs --file x.patch (or --file - for stdin, e.g. git diff | reportly diff ...)");
        return usage(() => blocks.diffHtml(readFile(flags.file), { name: flags.name }));
      });
    }
    case "term": {
      return dataBlock(command, args, flags, out, () => {
        if (flags.file === undefined) throw new UsageError("term needs --file out.txt (or --file - for stdin)");
        const lines = flags.lines === undefined ? undefined : Number(flags.lines);
        if (lines !== undefined && !(lines > 0)) throw new UsageError("--lines must be a positive number");
        return blocks.termHtml(readFile(flags.file), { cmd: flags.cmd, lines });
      });
    }
    case "code": {
      return dataBlock(command, args, flags, out, () => {
        if (flags.src === undefined) throw new UsageError("code needs --src PATH[:FROM[-TO]]");
        const spec = usage(() => blocks.parseCodeSpec(flags.src));
        // Label with the repo-relative path, so absolute home paths never reach the page.
        const rel = relative(process.cwd(), resolve(spec.path));
        const label = rel.startsWith("..") || isAbsolute(rel) ? basename(spec.path) : rel;
        return usage(() => blocks.codeHtml(readFile(spec.path), { ...spec, path: label, mark: flags.mark, title: flags.title, sub: flags.sub }));
      });
    }
    case "tests": {
      return dataBlock(command, args, flags, out, () => {
        if ((flags.junit === undefined) === (flags.json === undefined)) throw new UsageError("tests needs --junit FILE or --json FILE");
        const cases = usage(() => (flags.junit !== undefined ? blocks.parseJunit(readFile(flags.junit)) : blocks.jsonTests(readJson(flags.json))));
        return blocks.testsHtml(cases, { title: flags.title, sub: flags.sub });
      });
    }
    case "comments": {
      const [id] = need(args, 1, "comments ID [--since MS]");
      const query = flags.since === undefined ? "" : `?since=${encodeURIComponent(flags.since)}`;
      return out(await api("GET", `/docs/${seg(id)}/comments${query}`), printComments);
    }
    case "comment": {
      if (args.length < 2 || args.length > 3) throw new UsageError("usage: reportly comment ID SECTION [ITEM] --text T");
      const [id, section, item] = args;
      if (!flags.text) throw new UsageError("comment needs --text");
      const res = await api("POST", `/docs/${seg(id)}/comments`, defined({ section, item, body: flags.text }));
      return out(res, (r) => console.log(r.comment.id));
    }
    case "rm-comment": {
      const [id, commentId] = need(args, 2, "rm-comment ID COMMENT_ID");
      return out(await api("DELETE", `/docs/${seg(id)}/comments/${seg(commentId)}`), () => console.log(`deleted ${commentId}`));
    }
    case "rm-block": {
      const [id, section, key] = need(args, 3, "rm-block ID SECTION KEY");
      return out(await api("DELETE", `/docs/${seg(id)}/sections/${seg(section)}/blocks/${seg(key)}`), printWrite);
    }
    case "ops": {
      const [id] = need(args, 1, "ops ID --file ops.json");
      if (flags.file === undefined) throw new UsageError("ops needs --file ops.json (or --file - for stdin)");
      const text = readFile(flags.file);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new UsageError(`ops file is not valid JSON: ${err.message}`);
      }
      const ops = Array.isArray(parsed) ? parsed : parsed.ops;
      if (!Array.isArray(ops)) throw new UsageError('ops file must hold {"ops": [...]} or an array of ops');
      const res = await api("POST", `/docs/${seg(id)}/ops`, { ops });
      return out(res, (r) => {
        printWrite(r);
        if (r.keys?.length) console.log(`keys ${r.keys.join(" ")}`);
      });
    }
    default:
      throw new UsageError(`unknown command "${command}". Run "reportly help".`);
  }
}

try {
  await run(process.argv.slice(2));
} catch (err) {
  if (err instanceof UsageError || err instanceof ApiError) {
    console.error(`reportly: ${err.message}`);
    process.exit(err instanceof UsageError ? 2 : 1);
  }
  throw err;
}
