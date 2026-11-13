-- Uploaded images and videos. The bytes live in the MEDIA R2 bucket under the
-- same id; this row ties them to a document so they are deleted with it.
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX media_doc ON media(doc_id);

-- Reader comments on a section, or on one item inside it (an element with
-- data-item, such as a checklist entry). Agents read them back through the API.
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  item TEXT,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  from_agent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_doc ON comments(doc_id, created_at);
