// The CLI's data-to-html converters. node:test so `tsc` passes; run with `bun test`.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as b from "../skills/reportly/scripts/blocks.mjs";

describe("parseCsv", () => {
  test("handles quotes, doubled quotes, commas and CRLF", () => {
    const rows = b.parseCsv('name,note\r\n"Smith, J","said ""hi"""\r\n\r\nLee,ok\n');
    assert.deepEqual(rows, [
      ["name", "note"],
      ["Smith, J", 'said "hi"'],
      ["Lee", "ok"],
    ]);
  });
});

describe("tableHtml", () => {
  test("right-aligns numeric columns and escapes cells", () => {
    const html = b.tableHtml([
      ["Route", "p95"],
      ["<checkout>", "820"],
      ["/home", ""],
      ["/search", "12,400"],
    ]);
    assert.match(html, /<th class="num">p95<\/th>/);
    assert.match(html, /<td>&lt;checkout&gt;<\/td><td class="num">820<\/td>/);
    assert.match(html, /<td class="num">12,400<\/td>/);
  });

  test("does not treat version strings or text as numbers", () => {
    const html = b.tableHtml([["Tool", "Version"], ["node", "1,2"], ["bun", "1.2.3"]]);
    assert.doesNotMatch(html, /class="num"/);
  });
});

describe("chartHtml", () => {
  test("writes a report.chart call with colour and narrow expressions, not strings", () => {
    const html = b.chartHtml(
      [
        ["Week", "Before", "After"],
        ["1", "410", "300"],
      ],
      { id: "perf-p95", type: "bar", title: "p95 fell", y: "ms", target: 500, colors: ["no", "calm"] },
    );
    assert.match(html, /report\.chart\("perf-p95"/);
    assert.match(html, /"borderColor": report\.colors\.no/);
    assert.match(html, /"display": !narrow/);
    assert.doesNotMatch(html, /@@/);
  });

  test("rejects an unknown type", () => {
    assert.throws(() => b.chartHtml([["a", "b"], ["1", "2"]], { id: "x", type: "radar", title: "t" }), /--type/);
  });
});

describe("diffHtml", () => {
  test("splits files and keeps a removed '-- ' line inside its hunk", () => {
    const patch = [
      "diff --git a/a.sql b/a.sql",
      "--- a/a.sql",
      "+++ b/a.sql",
      "@@ -1,2 +1,1 @@",
      "--- old comment",
      " keep",
      "diff --git a/b.ts b/b.ts",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -1 +1 @@",
      "-x",
      "+y",
    ].join("\n");
    const html = b.diffHtml(patch);
    assert.equal(html.match(/<details class="patch"/g)?.length, 2);
    assert.match(html, /<span class="l del">--- old comment<\/span>/);
    assert.match(html, /data-name="b\.ts\.patch"/);
  });

  test("refuses text without hunks", () => {
    assert.throws(() => b.diffHtml("just text"), /no unified diff hunks/);
  });
});

describe("ansiToHtml", () => {
  test("maps colours to the palette, escapes text and drops other escapes", () => {
    const html = b.ansiToHtml("\x1b[32m✓ ok\x1b[0m <b>\x1b[2K\x1b[1;31mFAIL\x1b[39m\x1b[22m");
    assert.equal(html, '<span class="c-ok">✓ ok</span> &lt;b&gt;<span class="c-no"><b>FAIL</b></span>');
  });

  test("keeps only the last redraw of a carriage-return line", () => {
    assert.equal(b.ansiToHtml("10%\r50%\r100%\ndone"), "100%\ndone");
  });
});

describe("parseJunit", () => {
  test("reads passes, failures with messages, and skips", () => {
    const xml = `<testsuite><testcase classname="auth" name="logs in" time="0.1"/>
      <testcase classname="auth" name="rejects &quot;bad&quot; token"><failure message="expected 401"><![CDATA[at auth.ts:12]]></failure></testcase>
      <testcase name="later"><skipped/></testcase></testsuite>`;
    assert.deepEqual(b.parseJunit(xml), [
      { name: "auth > logs in", state: "pass", message: undefined },
      { name: 'auth > rejects "bad" token', state: "fail", message: "expected 401\n\nat auth.ts:12" },
      { name: "later", state: "skip", message: undefined },
    ]);
  });
});

describe("checklist items", () => {
  test("readCheck reads back what checkHtml wrote", () => {
    const html = b.checkHtml({ item: "tests", text: 'Run "all" <tests>', note: "412 of 600", state: "doing" });
    assert.deepEqual(b.readCheck(html), { text: 'Run "all" <tests>', note: "412 of 600", state: "doing" });
  });
});

describe("imageSize", () => {
  test("reads PNG dimensions from the header", () => {
    const png = Buffer.alloc(32);
    png.write("\x89PNG\r\n\x1a\n", 0, "latin1");
    png.writeUInt32BE(1440, 16);
    png.writeUInt32BE(900, 20);
    assert.deepEqual(b.imageSize(png), { width: 1440, height: 900 });
  });
});
