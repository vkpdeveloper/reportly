// Read side of documents. Writes live in lib/document-ops.ts.
import { db } from "./db";
import type { BlockRow, DocumentRow, DocumentSummary, FullDocument, Section, SectionRow } from "./types";

export function toSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    project: row.project,
    title: row.title,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDocumentRow(id: string) {
  return db().prepare("SELECT * FROM documents WHERE id = ?").bind(id).first<DocumentRow>();
}

/** Ordered sections, each with its ordered blocks. */
export async function loadSections(docId: string): Promise<Section[]> {
  const [sections, blocks] = await db().batch<SectionRow | BlockRow>([
    db().prepare("SELECT * FROM sections WHERE doc_id = ? ORDER BY position").bind(docId),
    db().prepare("SELECT * FROM blocks WHERE doc_id = ? ORDER BY position").bind(docId),
  ]);
  const bySection = new Map<string, Section["blocks"]>();
  for (const block of blocks.results as BlockRow[]) {
    const list = bySection.get(block.section_key) ?? [];
    list.push({ key: block.key, html: block.html });
    bySection.set(block.section_key, list);
  }
  return (sections.results as SectionRow[]).map((s) => ({
    key: s.key,
    nav: s.nav,
    html: s.html,
    rev: s.rev,
    blocks: bySection.get(s.key) ?? [],
  }));
}

export async function getDocument(id: string): Promise<FullDocument | null> {
  const row = await getDocumentRow(id);
  if (!row) return null;
  return { ...toSummary(row), userId: row.user_id, sections: await loadSections(id) };
}

export async function listDocuments(userId: string, opts: { q?: string; project?: string; limit?: number } = {}) {
  const where = ["user_id = ?"];
  const params: (string | number)[] = [userId];
  if (opts.project) {
    where.push("project = ?");
    params.push(opts.project);
  }
  if (opts.q) {
    const like = `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push("(title LIKE ? ESCAPE '\\' OR project LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  params.push(opts.limit ?? 200);
  const { results } = await db()
    .prepare(`SELECT * FROM documents WHERE ${where.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`)
    .bind(...params)
    .all<DocumentRow>();
  return results.map(toSummary);
}

export async function listProjects(userId: string) {
  const { results } = await db()
    .prepare("SELECT project, COUNT(*) AS count FROM documents WHERE user_id = ? GROUP BY project ORDER BY MAX(updated_at) DESC")
    .bind(userId)
    .all<{ project: string; count: number }>();
  return results;
}
