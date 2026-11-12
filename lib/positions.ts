// Pure, in-memory application of document ops. lib/document-ops.ts loads the
// current keys and order, runs the ops here, then diffs the result into SQL.
import { ApiError } from "./api-response";
import type { Op } from "./document-ops";

export const MAX_SECTIONS = 200;
export const MAX_BLOCKS = 500;

/** `html` undefined means "unchanged since load", which only happens for blocks that already existed. */
export type WorkBlock = { key: string; html?: string };

/** `nav` / `html` undefined means unchanged. `touched` means the section's rev must move to the new version. */
export type WorkSection = {
  key: string;
  nav?: string | null;
  html?: string;
  blocks: WorkBlock[];
  touched: boolean;
};

export type WorkState = {
  sections: WorkSection[];
  meta: { title?: string; project?: string; status?: "live" | "done" };
  generatedKeys: string[];
};

export type Placement = { before?: string; after?: string };

type Keyed = { key: string };

/**
 * Puts `item` into `list`. Without an anchor an existing item keeps its place and a
 * new one goes last; with `before` / `after` the item moves next to the anchor.
 */
export function place<T extends Keyed>(list: T[], item: T, at: Placement, kind: string): T[] {
  if (at.before !== undefined && at.after !== undefined) {
    throw new ApiError(400, "give before or after, not both");
  }
  const anchor = at.before ?? at.after;
  const index = list.findIndex((x) => x.key === item.key);
  if (anchor === undefined) {
    return index === -1 ? [...list, item] : list.with(index, item);
  }
  if (anchor === item.key) throw new ApiError(400, `${kind} ${item.key} cannot be placed relative to itself`);

  const rest = list.filter((x) => x.key !== item.key);
  const anchorIndex = rest.findIndex((x) => x.key === anchor);
  if (anchorIndex === -1) throw new ApiError(400, `unknown ${kind}: ${anchor}`);
  rest.splice(at.before !== undefined ? anchorIndex : anchorIndex + 1, 0, item);
  return rest;
}

/** Reorders `list` to `keys`, which must name every item exactly once. */
export function reorder<T extends Keyed>(list: T[], keys: string[]): T[] {
  const byKey = new Map(list.map((x) => [x.key, x]));
  const exact = keys.length === list.length && new Set(keys).size === keys.length && keys.every((k) => byKey.has(k));
  if (!exact) throw new ApiError(400, "order keys must list every section key exactly once");
  return keys.map((k) => byKey.get(k)!);
}

export function initialState(sections: { key: string; blocks: string[] }[]): WorkState {
  return {
    sections: sections.map((s) => ({ key: s.key, blocks: s.blocks.map((key) => ({ key })), touched: false })),
    meta: {},
    generatedKeys: [],
  };
}

function randomBlockKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `b-${Array.from(bytes, (b) => (b % 36).toString(36)).join("")}`;
}

function findSection(state: WorkState, key: string) {
  const section = state.sections.find((s) => s.key === key);
  if (!section) throw new ApiError(400, `unknown section: ${key}`);
  return section;
}

export function applyOp(state: WorkState, op: Op) {
  switch (op.op) {
    case "meta": {
      if (op.title !== undefined) state.meta.title = op.title;
      if (op.project !== undefined) state.meta.project = op.project;
      if (op.status !== undefined) state.meta.status = op.status;
      return;
    }
    case "section": {
      let section = state.sections.find((s) => s.key === op.key);
      if (!section) {
        if (state.sections.length >= MAX_SECTIONS) throw new ApiError(413, `a document holds at most ${MAX_SECTIONS} sections`);
        // A new section (including one re-added after removal) writes every field.
        section = { key: op.key, nav: null, html: "", blocks: [], touched: true };
      }
      if (op.nav !== undefined) {
        section.nav = op.nav;
        section.touched = true;
      }
      if (op.html !== undefined) {
        section.html = op.html;
        section.touched = true;
      }
      if (op.blocks !== undefined) {
        if (new Set(op.blocks.map((b) => b.key)).size !== op.blocks.length) {
          throw new ApiError(400, `duplicate block keys in section ${op.key}`);
        }
        section.blocks = op.blocks.map((b) => ({ key: b.key, html: b.html }));
        section.touched = true;
      }
      state.sections = place(state.sections, section, op, "section");
      return;
    }
    case "remove_section": {
      findSection(state, op.key);
      state.sections = state.sections.filter((s) => s.key !== op.key);
      return;
    }
    case "block": {
      const section = findSection(state, op.section);
      let key = op.key;
      if (key === undefined) {
        do key = randomBlockKey();
        while (section.blocks.some((b) => b.key === key));
        state.generatedKeys.push(key);
      }
      const existing = section.blocks.find((b) => b.key === key);
      if (!existing && section.blocks.length >= MAX_BLOCKS) {
        throw new ApiError(413, `a section holds at most ${MAX_BLOCKS} blocks`);
      }
      const block = existing ?? { key };
      block.html = op.html;
      section.blocks = place(section.blocks, block, op, "block");
      section.touched = true;
      return;
    }
    case "remove_block": {
      const section = findSection(state, op.section);
      if (!section.blocks.some((b) => b.key === op.key)) {
        throw new ApiError(400, `unknown block: ${op.key} in section ${op.section}`);
      }
      section.blocks = section.blocks.filter((b) => b.key !== op.key);
      section.touched = true;
      return;
    }
    case "order": {
      state.sections = reorder(state.sections, op.keys);
      return;
    }
  }
}
