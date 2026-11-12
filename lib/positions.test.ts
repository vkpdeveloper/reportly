// node:test (typed by @types/node) so `tsc` passes without bun types; run with `bun test`.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ApiError } from "./api-response";
import { applyOp, initialState, place, reorder } from "./positions";

const keys = (list: { key: string }[]) => list.map((x) => x.key);
const items = (...ks: string[]) => ks.map((key) => ({ key }));

function statusOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    if (error instanceof ApiError) return error.status;
    throw error;
  }
  return null;
}

describe("place", () => {
  test("appends new items and keeps existing ones in place", () => {
    assert.deepEqual(keys(place(items("a", "b"), { key: "c" }, {}, "section")), ["a", "b", "c"]);
    assert.deepEqual(keys(place(items("a", "b", "c"), { key: "b" }, {}, "section")), ["a", "b", "c"]);
  });

  test("inserts and moves relative to an anchor", () => {
    assert.deepEqual(keys(place(items("a", "b"), { key: "x" }, { before: "a" }, "section")), ["x", "a", "b"]);
    assert.deepEqual(keys(place(items("a", "b", "c"), { key: "a" }, { after: "c" }, "section")), ["b", "c", "a"]);
    assert.deepEqual(keys(place(items("a", "b", "c"), { key: "c" }, { before: "b" }, "section")), ["a", "c", "b"]);
  });

  test("rejects unknown anchors, self anchors and both anchors", () => {
    assert.equal(statusOf(() => place(items("a"), { key: "x" }, { before: "nope" }, "section")), 400);
    assert.equal(statusOf(() => place(items("a"), { key: "a" }, { after: "a" }, "section")), 400);
    assert.equal(statusOf(() => place(items("a", "b"), { key: "x" }, { before: "a", after: "b" }, "section")), 400);
  });
});

describe("reorder", () => {
  test("requires exactly the current set of keys", () => {
    assert.deepEqual(keys(reorder(items("a", "b", "c"), ["c", "a", "b"])), ["c", "a", "b"]);
    assert.equal(statusOf(() => reorder(items("a", "b"), ["a"])), 400);
    assert.equal(statusOf(() => reorder(items("a", "b"), ["a", "a"])), 400);
    assert.equal(statusOf(() => reorder(items("a", "b"), ["a", "z"])), 400);
  });
});

describe("applyOp", () => {
  const loaded = () =>
    initialState([
      { key: "answer", blocks: [] },
      { key: "videos", blocks: ["v1", "v2"] },
    ]);

  test("meta changes touch no section", () => {
    const state = loaded();
    applyOp(state, { op: "meta", status: "done" });
    assert.deepEqual(state.meta, { status: "done" });
    assert.ok(state.sections.every((s) => !s.touched));
  });

  test("a block change touches only its section; a pure move touches nothing", () => {
    const state = loaded();
    applyOp(state, { op: "block", section: "videos", key: "v2", html: "<video>", before: "v1" });
    applyOp(state, { op: "section", key: "answer", after: "videos" });
    assert.deepEqual(keys(state.sections), ["videos", "answer"]);
    assert.deepEqual(keys(state.sections[0].blocks), ["v2", "v1"]);
    assert.deepEqual(
      state.sections.map((s) => s.touched),
      [true, false],
    );
  });

  test("generated block keys are reported and unique", () => {
    const state = loaded();
    applyOp(state, { op: "block", section: "videos", html: "a" });
    applyOp(state, { op: "block", section: "videos", html: "b" });
    assert.equal(state.generatedKeys.length, 2);
    assert.match(state.generatedKeys[0], /^b-[0-9a-z]{8}$/);
    assert.notEqual(state.generatedKeys[0], state.generatedKeys[1]);
    assert.deepEqual(keys(state.sections[1].blocks), ["v1", "v2", ...state.generatedKeys]);
  });

  test("a section re-added after removal starts empty", () => {
    const state = loaded();
    applyOp(state, { op: "remove_section", key: "videos" });
    applyOp(state, { op: "section", key: "videos", html: "<h2>Again</h2>" });
    assert.deepEqual(state.sections[1], { key: "videos", nav: null, html: "<h2>Again</h2>", blocks: [], touched: true });
  });

  test("rejects block ops on unknown sections or blocks", () => {
    assert.equal(statusOf(() => applyOp(loaded(), { op: "block", section: "nope", html: "x" })), 400);
    assert.equal(statusOf(() => applyOp(loaded(), { op: "remove_block", section: "videos", key: "v9" })), 400);
  });
});
