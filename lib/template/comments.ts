// Reader comments, Notion style: a small button shows on hover next to each
// section heading and on each element with data-item (checklist entries,
// cards). It opens a popover with the thread and a form. Counts stay on screen.
// Reads report.state from the live client and hooks into report.enhance, so
// sections that arrive later get buttons too. No <form>: the page's CSP sandbox
// leaves out allow-forms, which blocks submission before the submit event fires.
export const commentsJs = String.raw`
  (function () {
    var state = report.state;
    if (!state) return;
    var url = state.liveUrl + "/comments";
    var KEY = /^[a-z0-9][a-z0-9-]{0,63}$/;
    var comments = state.comments.slice();
    var known = comments.length;
    var name = "";
    try { name = localStorage.getItem("reportly-name") || ""; } catch (e) {}
    var ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 2.75h10c.7 0 1.25.55 1.25 1.25v6c0 .7-.55 1.25-1.25 1.25H7.5L4.25 13.5v-2.25H3c-.7 0-1.25-.55-1.25-1.25V4c0-.7.55-1.25 1.25-1.25z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

    function thread(section, item) {
      return comments.filter(function (c) { return c.section === section && (c.item || null) === (item || null); });
    }
    function update(btn) {
      var n = thread(btn.dataset.section, btn.dataset.item).length;
      if (n) btn.dataset.count = n;
      else delete btn.dataset.count;
      btn.setAttribute("aria-label", n ? n + (n === 1 ? " comment" : " comments") : "Add a comment");
    }
    function attach(el, section, item) {
      if (el.querySelector(":scope > .cmt")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cmt";
      btn.dataset.section = section;
      if (item) btn.dataset.item = item;
      btn.innerHTML = ICON;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (pop && pop.anchor === btn && !pop.hidden) close();
        else open(btn);
      });
      el.append(btn);
      update(btn);
    }
    function scan(root) {
      var secs = root.matches && root.matches("main > section[id]") ? [root] : document.querySelectorAll("main > section[id]");
      Array.prototype.forEach.call(secs, function (sec) {
        if (!KEY.test(sec.id)) return;
        var heading = sec.querySelector(":scope > h1, :scope > h2");
        if (heading) attach(heading, sec.id, null);
        sec.querySelectorAll("[data-item]").forEach(function (el) {
          if (KEY.test(el.dataset.item)) attach(el, sec.id, el.dataset.item);
        });
      });
    }
    function refreshButtons() {
      document.querySelectorAll("main .cmt").forEach(update);
    }

    function ago(ms) {
      var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
      if (s < 60) return "just now";
      if (s < 3600) return Math.floor(s / 60) + " min ago";
      if (s < 86400) return Math.floor(s / 3600) + " h ago";
      return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    }

    var pop = null;
    function build() {
      pop = document.createElement("div");
      pop.className = "cmt-pop";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Comments");
      pop.hidden = true;
      pop.innerHTML = '<div class="cmt-list"></div>' +
        '<div class="cmt-form"><textarea rows="3" maxlength="2000" placeholder="Add a comment" aria-label="Comment"></textarea>' +
        '<div class="row"><input maxlength="60" placeholder="Your name" aria-label="Your name"><button type="button" class="btn">Comment</button></div>' +
        '<p class="cmt-err" hidden></p></div>';
      document.body.append(pop);
      var text = pop.querySelector("textarea");
      var who = pop.querySelector("input");
      who.value = name;
      text.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(text, who);
      });
      who.addEventListener("keydown", function (e) {
        if (e.key === "Enter") post(text, who);
      });
      pop.querySelector(".row .btn").addEventListener("click", function () { post(text, who); });
      pop.addEventListener("click", function (e) { e.stopPropagation(); });
      document.addEventListener("click", function () { if (!pop.hidden) close(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) close(); });
      window.addEventListener("resize", function () { if (!pop.hidden) position(); });
    }
    function renderThread() {
      var list = pop.querySelector(".cmt-list");
      list.textContent = "";
      var items = thread(pop.anchor.dataset.section, pop.anchor.dataset.item);
      list.hidden = !items.length;
      items.forEach(function (c) {
        var row = document.createElement("div");
        row.className = "c" + (c.fromAgent ? " agent" : "");
        var head = document.createElement("div");
        head.className = "who";
        var b = document.createElement("b");
        b.textContent = c.author;
        var t = document.createElement("time");
        t.textContent = ago(c.createdAt);
        head.append(b, t);
        var p = document.createElement("p");
        p.textContent = c.body;
        row.append(head, p);
        list.append(row);
      });
      list.scrollTop = list.scrollHeight;
    }
    function position() {
      var r = pop.anchor.getBoundingClientRect();
      var w = pop.offsetWidth;
      var left = Math.min(Math.max(16, r.right - w), document.documentElement.clientWidth - w - 16);
      pop.style.left = left + window.scrollX + "px";
      pop.style.top = r.bottom + window.scrollY + 6 + "px";
    }
    function open(btn) {
      if (!pop) build();
      pop.anchor = btn;
      pop.hidden = false;
      pop.querySelector(".cmt-err").hidden = true;
      renderThread();
      position();
      pop.querySelector("textarea").focus({ preventScroll: true });
    }
    function close() {
      pop.hidden = true;
      if (pop.anchor && pop.anchor.isConnected) pop.anchor.focus({ preventScroll: true });
    }
    var posting = false;
    async function post(text, who) {
      if (posting) return;
      var err = pop.querySelector(".cmt-err");
      var btn = pop.anchor;
      var body = { section: btn.dataset.section, item: btn.dataset.item || null, author: who.value.trim(), body: text.value.trim() };
      if (!body.body) return text.focus();
      posting = true;
      name = body.author;
      try { localStorage.setItem("reportly-name", name); } catch (e) {}
      err.hidden = true;
      try {
        var res = await fetch(url, { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not post the comment");
        comments.push(data.comment);
        known += 1;
        text.value = "";
        refreshButtons();
        renderThread();
      } catch (e) {
        err.textContent = e.message || "Could not post the comment";
        err.hidden = false;
      } finally {
        posting = false;
      }
    }

    var syncing = false;
    report.comments = {
      // Called by the live client with the server's count after each poll.
      sync: async function (count) {
        if (count === known || syncing) return;
        syncing = true;
        try {
          var res = await fetch(url, { cache: "no-store", credentials: "omit" });
          if (res.ok) {
            comments = (await res.json()).comments;
            known = comments.length;
            refreshButtons();
            if (pop && !pop.hidden) renderThread();
          }
        } catch (e) {
        } finally {
          syncing = false;
        }
      }
    };

    var enhance = report.enhance;
    report.enhance = function (root) {
      if (enhance) enhance(root);
      scan(root);
    };
    scan(document);
  })();
`;
