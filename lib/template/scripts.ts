// The template's three bottom scripts (side nav, Mermaid, sliders and copy
// buttons), reshaped into re-runnable functions on `window.report` so the live
// client can apply them to sections that arrive after load:
//   report.nav()             rebuilds the side nav from the current sections
//   report.diagrams(nodes)   renders pre.mermaid nodes not rendered yet
//   report.enhance(root)     binds sliders, copy, patch and hex inside root

export const navJs = String.raw`
  // Side nav: one numbered entry per main > section[id]. The label is the
  // section's data-nav, else its h2. The current section is the last one whose
  // top passed 30% of the viewport, or the final one at the bottom of the page.
  (function () {
    var nav = document.querySelector("nav.side");
    var ol = nav && nav.querySelector("ol");
    if (!ol) return;
    var sections = [];
    var links = [];
    var current = -1;
    var ticking = false;
    function build() {
      sections = Array.prototype.slice.call(document.querySelectorAll("main > section[id]"));
      ol.textContent = "";
      links = sections.map(function (sec, i) {
        var h2 = sec.querySelector("h2");
        var a = document.createElement("a");
        a.href = "#" + sec.id;
        var n = document.createElement("span");
        n.className = "n";
        n.textContent = String(i + 1).padStart(2, "0");
        var t = document.createElement("span");
        t.textContent = sec.dataset.nav || (h2 ? h2.textContent.trim() : sec.id);
        a.append(n, t);
        var li = document.createElement("li");
        li.append(a);
        ol.append(li);
        return a;
      });
      current = -1;
      mark();
    }
    function mark() {
      ticking = false;
      if (!sections.length) return;
      var probe = window.innerHeight * 0.3;
      var i = 0;
      sections.forEach(function (s, k) { if (s.getBoundingClientRect().top < probe) i = k; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = sections.length - 1;
      if (i === current) return;
      current = i;
      links.forEach(function (a, k) {
        if (k === i) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      // Keep the current entry visible inside the nav itself, never the page.
      var li = links[i].parentElement;
      if (ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: li.offsetLeft - 16 });
      if (nav.scrollHeight > nav.clientHeight) {
        var top = li.offsetTop - nav.clientHeight / 2;
        nav.scrollTo({ top: Math.max(0, top) });
      }
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(mark); }
    }, { passive: true });
    window.addEventListener("resize", mark);
    report.nav = build;
    build();
  })();
`;

export const diagramsJs = String.raw`
  // Mermaid: themed to the page, LR flips to TD under 720px, and re-renders when
  // the breakpoint changes. Loads only once a diagram exists.
  (function () {
    var narrow = window.matchMedia("(max-width: 720px)");
    var font = "Figtree, system-ui, sans-serif";
    var loading = null;
    function load() {
      if (loading) return loading;
      loading = import("https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.esm.min.mjs").then(function (m) {
        var mermaid = m.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: font,
          themeVariables: {
            darkMode: true,
            background: "#121214",
            fontFamily: font,
            fontSize: "14px",
            primaryColor: "#18181b",
            primaryTextColor: "#ededee",
            primaryBorderColor: "#2e2e33",
            secondaryColor: "#18181b",
            tertiaryColor: "#121214",
            lineColor: "#5a5a61",
            textColor: "#ededee",
            mainBkg: "#18181b",
            nodeBorder: "#2e2e33",
            clusterBkg: "#0b0b0c",
            clusterBorder: "#232327",
            titleColor: "#85858c",
            edgeLabelBackground: "#121214",
            actorBkg: "#18181b",
            actorBorder: "#2e2e33",
            actorTextColor: "#ededee",
            signalColor: "#85858c",
            signalTextColor: "#ededee",
            noteBkgColor: "#1e1b14",
            noteBorderColor: "#e8c27a",
            noteTextColor: "#ededee"
          },
          flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: true, nodeSpacing: 32, rankSpacing: 40, padding: 10, diagramPadding: 8, wrappingWidth: 160 },
          sequence: { useMaxWidth: true, mirrorActors: false },
          themeCSS: [
            ".node rect, .node polygon, .node circle, .node path { rx: 10px; ry: 10px; }",
            "g, rect, polygon, path, circle, ellipse, line { filter: none !important; }",
            ".flowchart-link.edge-thickness-normal { stroke-width: 1.5px; }",
            ".flowchart-link.edge-thickness-thick { stroke-width: 2.5px; stroke: #b9b9be; }",
            ".edgeLabel, .edgeLabel p { color: #85858c; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }",
            ".cluster-label, .cluster-label span { color: #85858c; font-weight: 600; }"
          ].join("\n")
        });
        return mermaid;
      });
      return loading;
    }
    var scale = function (el) {
      var svg = el.querySelector("svg");
      var vb = svg && svg.viewBox && svg.viewBox.baseVal;
      return vb && vb.width ? el.clientWidth / vb.width : 1;
    };
    var render = async function (mermaid, nodes, vertical) {
      nodes.forEach(function (el) {
        var src = el.dataset.src;
        if (vertical(el)) src = src.replace(/^(flowchart|graph)\s+(LR|RL)\b/m, "$1 TD");
        el.removeAttribute("data-processed");
        el.textContent = src;
      });
      await mermaid.run({ nodes: nodes, suppressErrors: true });
    };
    var draw = async function (blocks) {
      blocks = blocks.filter(function (el) { return el.isConnected; });
      if (!blocks.length) return;
      var mermaid = await load();
      await (document.fonts ? document.fonts.ready : Promise.resolve());
      await render(mermaid, blocks, function () { return narrow.matches; });
      // A sideways flow too long to show at 80% or more reads better top to bottom.
      var tooWide = narrow.matches ? [] : blocks.filter(function (el) { return /^(flowchart|graph)\s+(LR|RL)\b/m.test(el.dataset.src) && scale(el) < 0.8; });
      if (tooWide.length) await render(mermaid, tooWide, function () { return true; });
      // Never shrink a diagram below 70%; its box scrolls sideways instead.
      blocks.forEach(function (el) {
        var svg = el.querySelector("svg");
        var vb = svg && svg.viewBox && svg.viewBox.baseVal;
        if (!vb || !vb.width) return;
        svg.style.minWidth = el.clientWidth / vb.width < 0.7 ? Math.round(vb.width * 0.7) + "px" : "";
      });
      document.documentElement.dataset.diagrams = "ready";
    };
    // mermaid.run must not overlap with itself, so draws run one after another.
    var chain = Promise.resolve();
    var enqueue = function (blocks) {
      var run = chain.then(function () { return draw(blocks); });
      chain = run.catch(function () {});
      return run;
    };
    // data-src holds the original source; its presence marks a node as taken.
    report.diagrams = function (nodes) {
      var fresh = Array.prototype.filter.call(nodes, function (el) { return !el.dataset.src; });
      fresh.forEach(function (el) { el.dataset.src = el.textContent.trim(); });
      return enqueue(fresh);
    };
    var initial = document.querySelectorAll("pre.mermaid");
    if (initial.length) {
      report.diagrams(initial).then(function () {
        // Diagrams change the page height, so re-land a deep link.
        var target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target && window.scrollY > 0) target.scrollIntoView({ behavior: "instant" });
      });
    }
    var wasNarrow = narrow.matches;
    narrow.addEventListener("change", function () {
      if (narrow.matches === wasNarrow) return;
      wasNarrow = narrow.matches;
      enqueue(Array.prototype.slice.call(document.querySelectorAll("pre.mermaid[data-src]")));
    });
  })();
`;

export const widgetsJs = String.raw`
  // Sliders (drag anywhere, or arrow keys through the hidden range), copy
  // buttons, patch copy and download, and hex swatches.
  (function () {
    // Elements already wired up; enhance() runs again on sections that change.
    var bound = new WeakSet();
    var each = function (root, selector, fn) {
      root.querySelectorAll(selector).forEach(function (el) {
        if (bound.has(el)) return;
        bound.add(el);
        fn(el);
      });
    };

    var flash = function (btn, text) {
      var old = btn.textContent;
      btn.textContent = text;
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    // The page runs in a sandboxed (opaque) origin where the async clipboard
    // can be missing or refused, so fall back to a hidden textarea.
    var copyText = function (text) {
      var fallback = function () {
        var active = document.activeElement;
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.opacity = "0";
        document.body.append(ta);
        ta.focus({ preventScroll: true });
        ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        ta.remove();
        if (active && active.focus) active.focus({ preventScroll: true });
        return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback);
      } catch (e) {}
      return fallback();
    };
    var patchText = function (box) {
      return Array.prototype.map.call(box.querySelectorAll("pre.diff .l"), function (l) { return l.textContent; }).join("\n") + "\n";
    };
    var lum = function (c) { var v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

    report.enhance = function (root) {
      each(root, ".cmp", function (cmp) {
        var input = cmp.querySelector("input");
        var set = function (pct) {
          var v = Math.max(0, Math.min(100, pct));
          cmp.style.setProperty("--pos", v + "%");
          if (input) input.value = v;
        };
        var fromEvent = function (e) {
          var r = cmp.getBoundingClientRect();
          set(((e.clientX - r.left) / r.width) * 100);
        };
        var dragging = false;
        cmp.addEventListener("pointerdown", function (e) {
          dragging = true;
          cmp.setPointerCapture(e.pointerId);
          fromEvent(e);
          if (input) input.focus({ preventScroll: true });
        });
        cmp.addEventListener("pointermove", function (e) { if (dragging) fromEvent(e); });
        cmp.addEventListener("pointerup", function () { dragging = false; });
        cmp.addEventListener("pointercancel", function () { dragging = false; });
        if (input) input.addEventListener("input", function () { set(Number(input.value)); });
      });

      each(root, "details.patch", function (box) {
        var name = box.dataset.name || "change.patch";
        var copy = box.querySelector(".copy");
        var dl = box.querySelector(".dl");
        if (copy) copy.addEventListener("click", function (e) {
          e.preventDefault();
          copyText(patchText(box)).then(function () { flash(copy, "Copied"); }, function () {});
        });
        if (dl) dl.addEventListener("click", function (e) {
          e.preventDefault();
          var url = URL.createObjectURL(new Blob([patchText(box)], { type: "text/x-diff" }));
          var a = document.createElement("a");
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        });
      });
      each(root, "[data-copy]", function (btn) {
        btn.addEventListener("click", function () {
          copyText(btn.dataset.copy).then(function () { flash(btn, "Copied"); }, function () {});
        });
      });

      // class="hex": background is that colour, text black or white by WCAG contrast.
      root.querySelectorAll(".hex").forEach(function (el) {
        var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((el.dataset.color || el.textContent).trim());
        if (!m) return;
        var h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
        var L = 0.2126 * lum(parseInt(h.slice(0, 2), 16)) + 0.7152 * lum(parseInt(h.slice(2, 4), 16)) + 0.0722 * lum(parseInt(h.slice(4, 6), 16));
        el.style.background = "#" + h;
        el.style.color = (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? "#000000" : "#ffffff";
      });
    };
    report.enhance(document);
  })();
`;
