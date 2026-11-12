-- Reportly schema. Timestamps are unix milliseconds.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  last4 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX api_tokens_user ON api_tokens(user_id);

-- id is the public, unguessable document id used in /d/<id>.
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'done')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX documents_user_updated ON documents(user_id, updated_at DESC);

-- rev is the documents.version at which this section, or any block in it, last changed.
-- Live viewers only re-fetch sections whose rev is newer than what they have.
CREATE TABLE sections (
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  position INTEGER NOT NULL,
  nav TEXT,
  html TEXT NOT NULL DEFAULT '',
  rev INTEGER NOT NULL,
  PRIMARY KEY (doc_id, key)
);

-- Blocks render in order after their section's html. They let agents add or
-- replace one item (a video, a card) without resending the whole section.
CREATE TABLE blocks (
  doc_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  key TEXT NOT NULL,
  position INTEGER NOT NULL,
  html TEXT NOT NULL,
  PRIMARY KEY (doc_id, section_key, key),
  FOREIGN KEY (doc_id, section_key) REFERENCES sections(doc_id, key) ON DELETE CASCADE
);
