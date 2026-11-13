// Comments on a section, or on one item in it (an element with data-item).
// Readers post them from the viewer; agents read and answer them through the API.
import { z } from "zod";
import { ApiError } from "./api-response";
import { db } from "./db";
import { newId } from "./ids";

const MAX_COMMENTS_PER_DOC = 500;

const key = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "must match ^[a-z0-9][a-z0-9-]{0,63}$");

export const commentBodySchema = z.strictObject({
  section: key,
  item: key.nullish(),
  author: z.string().trim().max(60).optional(),
  body: z.string().trim().min(1).max(2000),
});

type CommentRow = {
  id: string;
  section: string;
  item: string | null;
  author: string;
  body: string;
  from_agent: number;
  created_at: number;
};

export type Comment = {
  id: string;
  section: string;
  item: string | null;
  author: string;
  body: string;
  fromAgent: boolean;
  createdAt: number;
};

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    section: row.section,
    item: row.item,
    author: row.author,
    body: row.body,
    fromAgent: row.from_agent === 1,
    createdAt: row.created_at,
  };
}

/** Oldest first. `since` (unix ms) returns only newer ones. */
export async function listComments(docId: string, since = 0) {
  const { results } = await db()
    .prepare("SELECT * FROM comments WHERE doc_id = ? AND created_at > ? ORDER BY created_at, id")
    .bind(docId, since)
    .all<CommentRow>();
  return results.map(toComment);
}

/** The document must exist and have the section. Owner checks happen in the caller. */
export async function addComment(docId: string, input: z.output<typeof commentBodySchema>, fromAgent: boolean) {
  const [section, count] = await db().batch<{ n: number }>([
    db().prepare("SELECT 1 AS n FROM sections WHERE doc_id = ? AND key = ?").bind(docId, input.section),
    db().prepare("SELECT COUNT(*) AS n FROM comments WHERE doc_id = ?").bind(docId),
  ]);
  if (!section.results.length) throw new ApiError(404, "section not found");
  if ((count.results[0]?.n ?? 0) >= MAX_COMMENTS_PER_DOC) throw new ApiError(429, "this document has too many comments");

  const comment: Comment = {
    id: newId(),
    section: input.section,
    item: input.item ?? null,
    author: input.author || (fromAgent ? "Agent" : "Reader"),
    body: input.body,
    fromAgent,
    createdAt: Date.now(),
  };
  await db()
    .prepare("INSERT INTO comments (id, doc_id, section, item, author, body, from_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(comment.id, docId, comment.section, comment.item, comment.author, comment.body, fromAgent ? 1 : 0, comment.createdAt)
    .run();
  return comment;
}
