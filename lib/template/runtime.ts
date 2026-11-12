// The template's `window.report` chart runtime, loaded in <head> so section
// scripts can call report.chart(...) while the page parses. Same theming as the
// html-communication template; it additionally supports charts registered after
// start and re-registration of a canvas id, both of which live updates need.
export const reportRuntimeJs = String.raw`
  // Chart runtime. Documents call report.chart(canvasId, narrow => chartJsConfig).
  // It themes Chart.js to the page, fills in colours the author left out, and
  // rebuilds every chart when the 720px breakpoint changes.
  window.report = (function () {
    var colors = {
      calm: "#8fd4b6", warn: "#e8c27a", no: "#e89a9a",
      ink: "#ededee", read: "#b9b9be", dim: "#85858c", faint: "#5a5a61",
      line: "#232327", line2: "#2e2e33", panel: "#121214", panel2: "#18181b", bg: "#0b0b0c"
    };
    // Calm first, then grays. Warn and no carry meaning, so they come last;
    // set them explicitly when a series means "limited" or "bad".
    var series = [colors.calm, colors.read, colors.dim, colors.warn, colors.no];
    var sans = "Figtree, system-ui, sans-serif";
    var mono = "'IBM Plex Mono', ui-monospace, monospace";
    var narrowQuery = window.matchMedia("(max-width: 720px)");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var cartesian = { line: true, bar: true, scatter: true, bubble: true };
    var radial = { doughnut: true, pie: true, polarArea: true };
    var queue = [];
    var ready = false;

    // Flat translucent fill. Alpha is two hex digits.
    function tint(hex, alpha) { return hex + (alpha || "26"); }

    if (window.Chart) {
      var D = Chart.defaults;
      D.font.family = sans;
      D.font.size = 13;
      D.color = colors.dim;
      D.borderColor = colors.line;
      D.responsive = true;
      D.maintainAspectRatio = false;
      D.animation.duration = reduced ? 0 : 500;
      D.interaction.mode = "index";
      D.interaction.intersect = false;
      D.plugins.legend.align = "start";
      D.plugins.legend.labels.color = colors.read;
      D.plugins.legend.labels.usePointStyle = true;
      D.plugins.legend.labels.pointStyle = "circle";
      D.plugins.legend.labels.boxWidth = 7;
      D.plugins.legend.labels.boxHeight = 7;
      D.plugins.legend.labels.padding = 14;
      var T = D.plugins.tooltip;
      T.backgroundColor = colors.panel2;
      T.borderColor = colors.line2;
      T.borderWidth = 1;
      T.padding = 10;
      T.cornerRadius = 10;
      T.titleColor = colors.dim;
      T.titleFont = { family: mono, size: 11, weight: "500" };
      T.bodyColor = colors.ink;
      T.bodyFont = { family: sans, size: 13 };
      T.boxPadding = 5;
      T.usePointStyle = true;
      D.elements.line.borderWidth = 2;
      D.elements.line.tension = 0.35;
      D.elements.line.cubicInterpolationMode = "monotone";
      D.elements.point.radius = 0;
      D.elements.point.hoverRadius = 4;
      D.elements.point.hitRadius = 12;
      D.elements.point.hoverBorderWidth = 2;
      D.elements.bar.borderRadius = 6;
      D.elements.arc.borderColor = colors.panel;
      D.elements.arc.borderWidth = 2;
      D.elements.arc.hoverOffset = 6;
      D.scale.grid.color = colors.line;
      D.scale.ticks.color = colors.dim;
      D.scale.ticks.font = { family: mono, size: 11 };
      D.scale.title.color = colors.dim;
      D.scale.title.font = { family: sans, size: 12 };
      Chart.overrides.doughnut.cutout = "70%";
    }

    function paint(cfg) {
      (cfg.data.datasets || []).forEach(function (ds, i) {
        var type = ds.type || cfg.type;
        var c = series[i % series.length];
        if (radial[type]) {
          if (!ds.backgroundColor) ds.backgroundColor = ds.data.map(function (_, j) { return series[j % series.length]; });
          return;
        }
        if (!ds.borderColor) ds.borderColor = c;
        c = typeof ds.borderColor === "string" ? ds.borderColor : c;
        if (!ds.backgroundColor) ds.backgroundColor = type === "bar" ? tint(c, "e6") : type === "line" ? tint(c, "1f") : tint(c, "b3");
        if (type === "bar" && ds.hoverBackgroundColor === undefined) ds.hoverBackgroundColor = c;
        if (type === "bar" && ds.maxBarThickness === undefined) ds.maxBarThickness = 44;
        if (type === "line" && ds.pointBackgroundColor === undefined) ds.pointBackgroundColor = c;
        if (type === "scatter" && ds.pointRadius === undefined) { ds.pointRadius = 5; ds.pointHoverRadius = 7; }
      });
    }

    function adapt(cfg, narrow) {
      var o = cfg.options = cfg.options || {};
      o.plugins = o.plugins || {};
      var legend = o.plugins.legend = o.plugins.legend || {};
      // Single-series charts say what they show in the caption, not a legend.
      if (legend.display === undefined && cfg.data.datasets.length < 2 && !radial[cfg.type]) legend.display = false;
      if (narrow && legend.position === undefined) legend.position = "bottom";
      if (!cartesian[cfg.type]) return;
      var points = cfg.type === "scatter" || cfg.type === "bubble";
      var cat = o.indexAxis === "y" ? "y" : "x";
      o.scales = o.scales || {};
      ["x", "y"].forEach(function (k) {
        var s = o.scales[k] = o.scales[k] || {};
        s.ticks = s.ticks || {};
        s.grid = s.grid || {};
        if (s.border === undefined) s.border = { display: false };
        if (s.ticks.maxRotation === undefined) s.ticks.maxRotation = 0;
        if (narrow && s.ticks.maxTicksLimit === undefined) s.ticks.maxTicksLimit = 6;
        if (k === cat && !points) {
          // Category labels are words: sans, brighter, no grid lines across them.
          if (s.grid.display === undefined) s.grid.display = false;
          if (!s.ticks.font) s.ticks.font = { family: sans, size: narrow ? 12 : 13 };
          if (!s.ticks.color) s.ticks.color = colors.read;
        }
      });
    }

    function destroy(entry) {
      // A destroyed chart has no canvas; destroying twice is a no-op.
      if (entry.chart && entry.chart.canvas) entry.chart.destroy();
      entry.chart = null;
    }

    function render(entry) {
      var canvas = document.getElementById(entry.id);
      if (!canvas || !window.Chart) return;
      var narrow = narrowQuery.matches;
      var cfg = entry.build(narrow);
      cfg.data = cfg.data || { datasets: [] };
      paint(cfg);
      adapt(cfg, narrow);
      destroy(entry);
      // Live updates can hand a canvas a new chart while an old one still owns it.
      var owner = Chart.getChart(canvas);
      if (owner) owner.destroy();
      entry.chart = new Chart(canvas, cfg);
    }

    function start() {
      if (ready) return;
      ready = true;
      queue.forEach(render);
      // Some resizes fire "change" without flipping the match; rebuild only on a real flip.
      var wasNarrow = narrowQuery.matches;
      narrowQuery.addEventListener("change", function () {
        if (narrowQuery.matches === wasNarrow) return;
        wasNarrow = narrowQuery.matches;
        // Forget charts whose canvas a live update removed.
        queue = queue.filter(function (entry) {
          if (document.getElementById(entry.id)) return true;
          destroy(entry);
          return false;
        });
        queue.forEach(render);
      });
    }
    function whenReady() {
      var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fonts.then(start, start);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", whenReady);
    else whenReady();

    return {
      colors: colors,
      tint: tint,
      chart: function (id, build) {
        // Registering an id again (a section re-sent by a live update) replaces the old entry.
        queue = queue.filter(function (entry) {
          if (entry.id !== id) return true;
          destroy(entry);
          return false;
        });
        var entry = { id: id, build: build };
        queue.push(entry);
        if (ready) render(entry);
      },
      get: function (id) { return window.Chart && Chart.getChart(id); }
    };
  })();
`;
