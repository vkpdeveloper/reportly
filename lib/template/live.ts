import type { DocumentStatus } from "../types";

export type LiveState = { id: string; version: number; status: DocumentStatus; liveUrl: string };

/**
 * Inline client that polls the live endpoint and patches the page in place.
 * It must run before the bottom scripts: it snapshots each section's original
 * top-level markup before the runtime enhances it, so an updated section keeps
 * the nodes that did not change (a playing video, a drawn chart) and only new
 * nodes are inserted.
 */
export function liveClientJs(state: LiveState): string {
  // "<" escaped so the JSON can never close the surrounding <script>.
  const json = JSON.stringify(state).replace(/</g, "\\u003c");
  return `
  (function () {
    var state = ${json};
    ${liveClientBody}
  })();
`;
}

const liveClientBody = String.raw`
    var POLL_MS = 3000;
    var MAX_BACKOFF_MS = 30000;
    var main = document.getElementById("top");
    var brand = document.querySelector("nav.side .brand");
    var inert = document.implementation.createHTMLDocument("");
    // Original markup of each top-level node inside a section. Nodes whose
    // markup is unchanged in an update are kept as they are.
    var sources = new WeakMap();

    function sourceOf(node) {
      if (node.nodeType === 1) return node.outerHTML;
      if (node.nodeType === 3) return "#text:" + node.data;
      if (node.nodeType === 8) return "#comment:" + node.data;
      return null;
    }
    function record(sec) {
      sec.childNodes.forEach(function (node) { sources.set(node, sourceOf(node)); });
    }
    main.querySelectorAll(":scope > section").forEach(record);

    function within(node, selector) {
      if (node.nodeType !== 1) return [];
      var found = Array.prototype.slice.call(node.querySelectorAll(selector));
      if (node.matches(selector)) found.unshift(node);
      return found;
    }
    function teardown(node) {
      if (!window.Chart) return;
      within(node, "canvas").forEach(function (canvas) {
        var chart = Chart.getChart(canvas);
        if (chart) chart.destroy();
      });
    }
    // Scripts parsed through innerHTML never run; a fresh copy does once connected.
    function runnable(old) {
      var script = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (a) { script.setAttribute(a.name, a.value); });
      script.text = old.text;
      if (script.src) script.async = false;
      return script;
    }
    function activate(node) {
      node = document.adoptNode(node);
      if (node.nodeName === "SCRIPT") return runnable(node);
      within(node, "script").forEach(function (s) { s.replaceWith(runnable(s)); });
      return node;
    }
    // Put children in order, moving only nodes that are out of place.
    // moveBefore keeps a playing video or a loaded iframe intact where supported.
    function place(parent, nodes) {
      var at = parent.firstChild;
      nodes.forEach(function (node) {
        if (node === at) { at = at.nextSibling; return; }
        if (parent.moveBefore && node.isConnected) parent.moveBefore(node, at);
        else parent.insertBefore(node, at);
      });
    }

    function patch(sec, html) {
      var box = inert.createElement("section");
      box.innerHTML = html;
      var old = Array.prototype.slice.call(sec.childNodes);
      var from = 0;
      var kept = new Set();
      var freshCanvas = false;
      var next = Array.prototype.map.call(box.childNodes, function (node) {
        var src = sourceOf(node);
        for (var i = from; src !== null && i < old.length; i++) {
          if (sources.get(old[i]) === src) {
            from = i + 1;
            return { node: old[i], src: src, kept: true };
          }
        }
        if (within(node, "canvas").length) freshCanvas = true;
        return { node: node, src: src, kept: false };
      });
      var nodes = next.map(function (item) {
        // A new canvas may belong to an unchanged chart script, so scripts rerun then.
        var keep = item.kept && !(freshCanvas && item.node.nodeName === "SCRIPT");
        if (keep) {
          kept.add(item.node);
          return item.node;
        }
        var fresh = activate(item.node.ownerDocument === document ? item.node.cloneNode(true) : item.node);
        sources.set(fresh, item.src);
        return fresh;
      });
      old.forEach(function (node) {
        if (kept.has(node)) return;
        teardown(node);
        node.remove();
      });
      place(sec, nodes);
    }

    function placeholder(title) {
      var sec = main.querySelector(":scope > section:not([id])") || document.createElement("section");
      var h1 = sec.querySelector("h1") || sec.appendChild(document.createElement("h1"));
      h1.textContent = title;
      return sec;
    }

    // The topmost visible element, so it can be held still while content above it changes.
    function findAnchor() {
      if (window.scrollY <= 0) return null;
      var secs = main.querySelectorAll(":scope > section");
      for (var i = 0; i < secs.length; i++) {
        var box = secs[i].getBoundingClientRect();
        if (box.bottom <= 0) continue;
        var kids = secs[i].children;
        for (var k = 0; k < kids.length; k++) {
          var r = kids[k].getBoundingClientRect();
          if (r.bottom > 0 && r.height > 0) return { el: kids[k], top: r.top, section: secs[i], sectionTop: box.top };
        }
        return { el: secs[i], top: box.top, section: secs[i], sectionTop: box.top };
      }
      return null;
    }
    function restore(anchor) {
      if (!anchor) return;
      var el = anchor.el.isConnected ? anchor.el : anchor.section.isConnected ? anchor.section : null;
      if (!el) return;
      var delta = el.getBoundingClientRect().top - (el === anchor.el ? anchor.top : anchor.sectionTop);
      if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: "instant" });
    }

    // Returns true when the response referenced a section this page does not have,
    // which means the page must resync from version 0.
    function apply(data) {
      if (typeof data.title === "string") {
        document.title = data.title;
        if (brand) brand.textContent = data.title;
      }
      var anchor = findAnchor();
      var existing = new Map();
      main.querySelectorAll(":scope > section[id]").forEach(function (sec) { existing.set(sec.id, sec); });
      var changed = [];
      var resync = false;
      var ordered = [];
      data.sections.forEach(function (s) {
        var sec = existing.get(s.key);
        var hasHtml = typeof s.html === "string";
        if (!sec && !hasHtml) { resync = true; return; }
        if (!sec) {
          sec = document.createElement("section");
          sec.id = s.key;
        }
        if (s.nav) sec.dataset.nav = s.nav;
        else delete sec.dataset.nav;
        if (hasHtml) {
          patch(sec, s.html);
          changed.push(sec);
        }
        ordered.push(sec);
      });
      if (!ordered.length) ordered.push(placeholder(document.title));
      var keep = new Set(ordered);
      Array.prototype.slice.call(main.childNodes).forEach(function (node) {
        if (keep.has(node)) return;
        teardown(node);
        node.remove();
      });
      place(main, ordered);

      changed.forEach(function (sec) { if (report.enhance) report.enhance(sec); });
      if (report.nav) report.nav();
      restore(anchor);

      var flows = [];
      changed.forEach(function (sec) { flows.push.apply(flows, sec.querySelectorAll("pre.mermaid")); });
      if (flows.length && report.diagrams) {
        // Diagrams change height once drawn; hold the reader's place unless they scrolled meanwhile.
        var later = findAnchor();
        var y = window.scrollY;
        report.diagrams(flows).then(function () {
          if (window.scrollY === y) restore(later);
        }, function () {});
      }
      return resync;
    }

    var timer = null;
    var inflight = false;
    var failures = 0;
    function schedule(ms) {
      clearTimeout(timer);
      timer = setTimeout(poll, ms);
    }
    async function poll() {
      timer = null;
      if (inflight || document.hidden || state.status !== "live") return;
      inflight = true;
      var delay = POLL_MS;
      try {
        var res = await fetch(state.liveUrl + "?since=" + state.version, { cache: "no-store", credentials: "omit" });
        if (res.status === 404) {
          // The document was deleted; keep what is on screen and stop.
          state.status = "done";
        } else if (!res.ok) {
          throw new Error("live " + res.status);
        } else {
          var data = await res.json();
          failures = 0;
          var resync = false;
          if (Array.isArray(data.sections)) {
            try {
              resync = apply(data);
            } catch (err) {
              console.error("Live update failed", err);
            }
          }
          state.version = resync ? 0 : data.version;
          state.status = data.status;
          if (resync) delay = 0;
        }
      } catch (err) {
        failures += 1;
        delay = Math.min(MAX_BACKOFF_MS, POLL_MS * (failures + 1));
      } finally {
        inflight = false;
      }
      if (state.status === "live" && !document.hidden) schedule(delay);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        clearTimeout(timer);
        timer = null;
      } else if (!inflight && state.status === "live") {
        schedule(0);
      }
    });
    if (state.status === "live" && !document.hidden) schedule(POLL_MS);
`;
