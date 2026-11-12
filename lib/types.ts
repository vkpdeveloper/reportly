export type DocumentStatus = "live" | "done";

export type DocumentRow = {
  id: string;
  user_id: string;
  project: string;
  title: string;
  status: DocumentStatus;
  version: number;
  created_at: number;
  updated_at: number;
};

export type SectionRow = {
  doc_id: string;
  key: string;
  position: number;
  nav: string | null;
  html: string;
  rev: number;
};

export type BlockRow = {
  doc_id: string;
  section_key: string;
  key: string;
  position: number;
  html: string;
};

export type Block = { key: string; html: string };

export type Section = {
  key: string;
  nav: string | null;
  html: string;
  rev: number;
  blocks: Block[];
};

export type FullDocument = {
  id: string;
  userId: string;
  project: string;
  title: string;
  status: DocumentStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
  /** Ordered by position. Blocks ordered by position. */
  sections: Section[];
};

export type DocumentSummary = Omit<FullDocument, "sections" | "userId">;
