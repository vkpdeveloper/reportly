#!/usr/bin/env node
// Reportly CLI: create a live document, then push sections and blocks to it.
// Zero dependencies, Node 18+ or Bun. Reads REPORTLY_URL and REPORTLY_TOKEN.
// The API contract lives in docs/api.md of the Reportly repo.

import { readFileSync } from "node:fs";

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

Options
  --json      Print the raw API response as JSON.
  --file -    Read html (or ops json) from stdin.
  help        Show this help.

Environment
  REPORTLY_URL     Base url, e.g. https://reportly.example.workers.dev
  REPORTLY_TOKEN   API token (rpt_...), created on the Tokens page of the dashboard.
`;

const VALUE_FLAGS = new Set(["title", "project", "hero", "q", "status", "file", "html", "nav", "before", "after"]);
const BOOL_FLAGS = new Set(["json", "help"]);

class UsageError extends Error {}
class ApiError extends Error {}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
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
      flags[name] = value;
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

async function api(method, path, body) {
  const { base, token } = config();
  const url = `${base}/api/v1${path}`;
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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
      const base = `/docs/${seg(id)}/sections/${seg(section)}/blocks`;
      if (key !== undefined) {
        return out(await api("PUT", `${base}/${seg(key)}`, defined({ html, before: flags.before, after: flags.after })), printWrite);
      }
      if (flags.before === undefined && flags.after === undefined) {
        return out(await api("POST", base, { html }), (r) => console.log(r.key));
      }
      // The append endpoint takes no position, so a positioned keyless block goes through ops.
      const op = defined({ op: "block", section, html, before: flags.before, after: flags.after });
      const res = await api("POST", `/docs/${seg(id)}/ops`, { ops: [op] });
      return out(res, (r) => console.log(r.keys?.[0] ?? ""));
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
