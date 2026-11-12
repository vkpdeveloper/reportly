// Write side of documents. Every write goes through ops so that all endpoints
// share one validation path and bump the version exactly once.
import { z } from "zod";
import { ApiError } from "./api-response";
import { db } from "./db";
import { newDocumentId } from "./ids";
import { applyOp, initialState, MAX_BLOCKS, MAX_SECTIONS, type WorkState } from "./positions";

const MAX_HTML_BYTES = 1024 * 1024;

function fitsHtmlLimit(value: string) {
  // UTF-8 needs 1 to 3 bytes per UTF-16 unit, so only measure when it could matter.
  if (value.length * 3 <= MAX_HTML_BYTES) return true;
  if (value.length > MAX_HTML_BYTES) return false;
  return new TextEncoder().encode(value).length <= MAX_HTML_BYTES;
}

const key = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "must match ^[a-z0-9][a-z0-9-]{0,63}$");
const html = z.string().refine(fitsHtmlLimit, { message: "html is larger than 1 MB", params: { status: 413 } });
const title = z.string().trim().min(1).max(200);
const project = z.string().trim().min(1).max(100);
const status = z.enum(["live", "done"]);
const nav = z.string().max(200).nullable();
const blocks = z.array(z.strictObject({ key, html })).max(MAX_BLOCKS);
const placement = { before: key.optional(), after: key.optional() };

const metaFields = { title: title.optional(), project: project.optional(), status: status.optional() };

export const opSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("meta"), ...metaFields }),
  z.strictObject({
    op: z.literal("section"),
    key,
    nav: nav.optional(),
    html: html.optional(),
    blocks: blocks.optional(),
    ...placement,
  }),
  z.strictObject({ op: z.literal("remove_section"), key }),
  z.strictObject({ op: z.literal("block"), section: key, key: key.optional(), html, ...placement }),
  z.strictObject({ op: z.literal("remove_block"), section: key, key }),
  z.strictObject({ op: z.literal("order"), keys: z.array(key).max(MAX_SECTIONS) }),
]);
export type Op = z.output<typeof opSchema>;

export const opsBodySchema = z.strictObject({ ops: z.array(opSchema).min(1).max(1000) });

export const metaBodySchema = z
  .strictObject(metaFields)
  .refine((m) => Object.values(m).some((v) => v !== undefined), "give at least one of title, project, status");

export const createBodySchema = z.strictObject({
  title,
  project,
  sections: z
    .array(z.strictObject({ key, nav: nav.optional(), html: html.optional(), blocks: blocks.optional() }))
    .max(MAX_SECTIONS)
    .optional(),
});

type Original = Map<string, { position: number; blocks: Map<string, number> }>;

/**
 * Statements that turn `original` into `state`. Each one only runs while the
 * document is still at `readVersion`, so a writer that lost a race writes nothing
 * (D1 runs a batch as one transaction, so no other write can land mid-batch).
 */
function buildWrites(docId: string, original: Original, state: WorkState, readVersion: number, rev: number) {
  const guard = "(SELECT version FROM documents WHERE id = ?) = ?";
  const stmt = (sql: string, ...params: (string | number | null)[]) =>
    db().prepare(`${sql} AND ${guard}`).bind(...params, docId, readVersion);
  const stmts: D1PreparedStatement[] = [];

  const finalKeys = new Set(state.sections.map((s) => s.key));
  const removed = [...original.keys()].filter((k) => !finalKeys.has(k));
  if (removed.length > 0) {
    // Blocks go with their section through ON DELETE CASCADE.
    stmts.push(stmt("DELETE FROM sections WHERE doc_id = ? AND key IN (SELECT value FROM json_each(?))", docId, JSON.stringify(removed)));
  }

  const insertBlock = (sectionKey: string, blockKey: string, position: number, blockHtml: string) =>
    stmt(
      "INSERT INTO blocks (doc_id, section_key, key, position, html) SELECT ?, ?, ?, ?, ? WHERE 1",
      docId,
      sectionKey,
      blockKey,
      position,
      blockHtml,
    );

  let sectionsMoved = false;
  state.sections.forEach((section, position) => {
    const orig = original.get(section.key);
    if (!orig) {
      stmts.push(
        stmt(
          "INSERT INTO sections (doc_id, key, position, nav, html, rev) SELECT ?, ?, ?, ?, ?, ? WHERE 1",
          docId,
          section.key,
          position,
          section.nav ?? null,
          section.html ?? "",
          rev,
        ),
      );
      section.blocks.forEach((b, i) => stmts.push(insertBlock(section.key, b.key, i, b.html ?? "")));
      return;
    }

    if (orig.position !== position) sectionsMoved = true;
    const updates: [column: string, value: string | number | null][] = [];
    if (section.touched) updates.push(["rev", rev]);
    if (section.nav !== undefined) updates.push(["nav", section.nav]);
    if (section.html !== undefined) updates.push(["html", section.html]);
    if (updates.length > 0) {
      const sets = updates.map(([column]) => `${column} = ?`).join(", ");
      const values = updates.map(([, value]) => value);
      stmts.push(stmt(`UPDATE sections SET ${sets} WHERE doc_id = ? AND key = ?`, ...values, docId, section.key));
    }

    const blockKeys = new Set(section.blocks.map((b) => b.key));
    const removedBlocks = [...orig.blocks.keys()].filter((k) => !blockKeys.has(k));
    if (removedBlocks.length > 0) {
      stmts.push(
        stmt(
          "DELETE FROM blocks WHERE doc_id = ? AND section_key = ? AND key IN (SELECT value FROM json_each(?))",
          docId,
          section.key,
          JSON.stringify(removedBlocks),
        ),
      );
    }
    let blocksMoved = false;
    section.blocks.forEach((b, i) => {
      const origPosition = orig.blocks.get(b.key);
      if (origPosition === undefined) {
        stmts.push(insertBlock(section.key, b.key, i, b.html ?? ""));
        return;
      }
      if (origPosition !== i) blocksMoved = true;
      if (b.html !== undefined) {
        stmts.push(stmt("UPDATE blocks SET html = ? WHERE doc_id = ? AND section_key = ? AND key = ?", b.html, docId, section.key, b.key));
      }
    });
    if (blocksMoved) {
      const order = JSON.stringify(section.blocks.map((b) => b.key));
      stmts.push(
        stmt(
          "UPDATE blocks SET position = (SELECT CAST(j.key AS INTEGER) FROM json_each(?) AS j WHERE j.value = blocks.key) WHERE doc_id = ? AND section_key = ?",
          order,
          docId,
          section.key,
        ),
      );
    }
  });

  if (sectionsMoved) {
    // Renumbers every section to 0..n-1 in one statement; json_each yields (index, key) pairs.
    const order = JSON.stringify(state.sections.map((s) => s.key));
    stmts.push(
      stmt(
        "UPDATE sections SET position = (SELECT CAST(j.key AS INTEGER) FROM json_each(?) AS j WHERE j.value = sections.key) WHERE doc_id = ?",
        order,
        docId,
      ),
    );
  }
  return stmts;
}

async function readSnapshot(docId: string) {
  const [doc, sections, blocks] = await db().batch<Record<string, string | number>>([
    db().prepare("SELECT user_id, version FROM documents WHERE id = ?").bind(docId),
    db().prepare("SELECT key, position FROM sections WHERE doc_id = ? ORDER BY position, key").bind(docId),
    db().prepare("SELECT section_key, key, position FROM blocks WHERE doc_id = ? ORDER BY position, key").bind(docId),
  ]);
  const row = doc.results[0] as { user_id: string; version: number } | undefined;
  if (!row) return null;

  const original: Original = new Map();
  for (const s of sections.results as { key: string; position: number }[]) {
    original.set(s.key, { position: s.position, blocks: new Map() });
  }
  const blockOrder = new Map<string, string[]>();
  for (const b of blocks.results as { section_key: string; key: string; position: number }[]) {
    original.get(b.section_key)?.blocks.set(b.key, b.position);
    const keys = blockOrder.get(b.section_key) ?? [];
    keys.push(b.key);
    blockOrder.set(b.section_key, keys);
  }
  const ordered = [...original.keys()].map((k) => ({ key: k, blocks: blockOrder.get(k) ?? [] }));
  return { userId: row.user_id, version: row.version, original, ordered };
}

const MAX_ATTEMPTS = 5;

/** Applies `ops` atomically as one version bump. Throws 404 unless `userId` owns the document. */
export async function applyOps(docId: string, userId: string, ops: Op[]) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const snapshot = await readSnapshot(docId);
    if (!snapshot || snapshot.userId !== userId) throw new ApiError(404, "document not found");

    const state = initialState(snapshot.ordered);
    for (const op of ops) applyOp(state, op);

    const version = snapshot.version + 1;
    const bump = db()
      .prepare(
        `UPDATE documents
         SET version = version + 1, updated_at = ?,
             title = COALESCE(?, title), project = COALESCE(?, project), status = COALESCE(?, status)
         WHERE id = ? AND version = ?`,
      )
      .bind(Date.now(), state.meta.title ?? null, state.meta.project ?? null, state.meta.status ?? null, docId, snapshot.version);
    const results = await db().batch([...buildWrites(docId, snapshot.original, state, snapshot.version, version), bump]);
    if (results.at(-1)?.meta.changes === 1) return { version, keys: state.generatedKeys };

    // Another writer got there first: back off briefly and redo it on the new state.
    await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 80 * (attempt + 1)));
  }
  throw new ApiError(409, "document is being changed by another writer, retry");
}

export async function createDocument(userId: string, input: z.output<typeof createBodySchema>) {
  const state = initialState([]);
  for (const section of input.sections ?? []) applyOp(state, { op: "section", ...section });

  const id = newDocumentId(input.title);
  const now = Date.now();
  await db().batch([
    db()
      .prepare(
        "INSERT INTO documents (id, user_id, project, title, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'live', 1, ?, ?)",
      )
      .bind(id, userId, input.project, input.title, now, now),
    ...buildWrites(id, new Map(), state, 1, 1),
  ]);
  return { id, version: 1 };
}
