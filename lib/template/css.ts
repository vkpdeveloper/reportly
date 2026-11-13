// The html-communication template stylesheet, copied verbatim plus marked
// Reportly additions (media, live status, new blocks, comments, print).
// Do not restyle the template parts.
export const templateCss = String.raw`
:root{
  --bg:#0b0b0c; --panel:#121214; --panel-2:#18181b; --line:#232327; --line-2:#2e2e33;
  --ink:#ededee; --read:#b9b9be; --dim:#85858c; --faint:#5a5a61;
  --calm:#8fd4b6; --calm-bg:rgba(143,212,182,.09);
  --warn:#e8c27a; --warn-bg:rgba(232,194,122,.09);
  --no:#e89a9a; --no-bg:rgba(232,154,154,.09);
  --mono:"IBM Plex Mono",ui-monospace,monospace;
  --sans:"Figtree",system-ui,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--read);font:16.5px/1.65 var(--sans);overflow-x:hidden}
a{color:var(--ink);text-decoration-color:var(--line-2);text-underline-offset:3px}
a:hover{text-decoration-color:var(--calm)}
h1,h2,h3{color:var(--ink);font-weight:650;letter-spacing:-.015em;line-height:1.2;margin:0}
h1{font-size:clamp(2rem,4.6vw,3rem);letter-spacing:-.03em}
h2{font-size:1.55rem;margin-bottom:.9rem}
h3{font-size:1.05rem;margin-bottom:.35rem}
p{margin:0 0 .9rem}
strong{color:var(--ink);font-weight:600}
code{font:500 .86em var(--mono);background:var(--panel-2);border:1px solid var(--line);padding:.05em .35em;border-radius:5px;color:var(--ink);word-break:break-word}
img,svg,canvas{max-width:100%}

/* Layout: sticky side nav + one reading column */
.shell{display:grid;grid-template-columns:240px minmax(0,1fr);max-width:1180px;margin:0 auto;gap:56px;padding:0 32px}
main{padding:64px 0 120px;min-width:0;max-width:780px}
section{padding-top:72px;scroll-margin-top:24px}
section:first-of-type{padding-top:0}

/* Side nav: filled from main > section[id] by the nav script */
nav.side{position:sticky;top:0;align-self:start;height:100vh;padding:48px 0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
nav.side::-webkit-scrollbar{display:none}
nav.side .brand{display:block;padding:0 10px;margin-bottom:28px;font-weight:700;color:var(--ink);letter-spacing:-.01em;line-height:1.3;text-decoration:none}
nav.side ol{list-style:none;margin:0;padding:0}
nav.side ol a{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:baseline;padding:7px 10px;border-radius:8px;color:var(--dim);text-decoration:none;font-size:.93rem;line-height:1.35}
nav.side .n{font:500 .72rem var(--mono);font-variant-numeric:tabular-nums;letter-spacing:.02em;color:var(--faint)}
nav.side ol a:hover,nav.side ol a[aria-current="true"]{background:var(--panel);color:var(--ink)}
nav.side ol a[aria-current="true"] .n{color:var(--calm)}
nav.side a:focus-visible{outline:2px solid var(--calm);outline-offset:-2px}

/* Hero */
.kicker{font:500 .78rem var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--calm);margin-bottom:14px}
.lede{font-size:1.15rem;color:var(--read);max-width:40em;margin:18px 0 32px}
.verdict{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:0 0 8px}
.verdict div{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 16px 14px}
.verdict b{display:block;font:600 1.5rem/1.1 var(--sans);color:var(--ink);margin-bottom:6px}
.verdict span{font-size:.88rem;color:var(--dim);line-height:1.4;display:block}

/* Status pills */
.pill{display:inline-flex;align-items:center;gap:6px;font:500 .72rem/1 var(--mono);letter-spacing:.03em;padding:5px 8px;border-radius:99px;white-space:nowrap}
.pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.ok{color:var(--calm);background:var(--calm-bg)}
.mid{color:var(--warn);background:var(--warn-bg)}
.no{color:var(--no);background:var(--no-bg)}
.legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin:4px 0 20px;font-size:.88rem;color:var(--dim);align-items:center}

/* Cards */
.cards{display:grid;gap:10px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;min-width:0}
.card .top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:4px}
.card h3{margin:0}
.card p{margin:0;font-size:.95rem}
.card .how{margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:.86rem;color:var(--dim)}
.card .how b{color:var(--read);font-weight:600}
.group{margin:28px 0 10px;font:500 .78rem var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}

/* Notes */
.note{border-left:2px solid var(--calm);padding:4px 0 4px 16px;margin:18px 0;color:var(--read)}
.note.warn{border-color:var(--warn)}
.note.no{border-color:var(--no)}

/* Tables */
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:.92rem;min-width:520px}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 .74rem var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--faint);background:var(--panel-2)}
tr:last-child td{border-bottom:0}
td:first-child{color:var(--ink);font-weight:500}
th.num,td.num{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}

/* Figures: charts, Mermaid diagrams, hand-drawn SVG */
.diagram{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px;margin:8px 0 18px;min-width:0}
.diagram > svg{width:100%;height:auto;display:block}
.diagram figcaption{margin:0 0 14px}
.diagram figcaption strong{display:block;font-size:1rem;line-height:1.35}
.diagram figcaption span{display:block;font-size:.84rem;color:var(--dim);margin-top:2px}
.cap{font-size:.86rem;color:var(--dim);margin-top:10px}
figure{margin:0}
.chart{position:relative;height:300px}
.chart.short{height:220px}
.chart.tall{height:400px}
.chart.square{height:280px}
.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:8px 0 18px}
.grid-2 > .diagram{margin:0}
pre.mermaid{margin:0;overflow-x:auto;text-align:center;font:400 .8rem var(--mono);color:var(--faint);background:none}
pre.mermaid svg{max-width:100%;height:auto}
/* Reportly addition: recordings and screenshots size themselves without inline styles */
main video,.diagram img{display:block;width:100%;height:auto;border-radius:10px;background:var(--panel)}
main section > video{margin:8px 0 18px}

/* Phases and questions */
.phases{display:grid;gap:10px}
.phase{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;min-width:0}
.phase .num{font:500 .8rem var(--mono);color:var(--calm);padding-top:3px}
.phase ul{margin:8px 0 0;padding-left:18px}
.phase li{margin:3px 0;font-size:.95rem}
.qs{counter-reset:q;list-style:none;padding:0;margin:0;display:grid;gap:10px}
.qs li{counter-increment:q;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px 14px 52px;position:relative}
.qs li::before{content:counter(q);position:absolute;left:18px;top:14px;font:500 .85rem var(--mono);color:var(--calm)}

/* Current vs proposed slider */
.cmp{position:relative;--pos:50%;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel);cursor:ew-resize;touch-action:pan-y;user-select:none;margin:8px 0 18px}
.cmp img{display:block;width:100%;height:auto;pointer-events:none}
.cmp img.after{position:absolute;inset:0;height:100%;object-fit:cover;clip-path:inset(0 0 0 var(--pos))}
.cmp .divider{position:absolute;top:0;bottom:0;left:var(--pos);width:2px;margin-left:-1px;background:var(--ink)}
.cmp .knob{position:absolute;top:50%;left:var(--pos);transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:var(--panel-2);border:1px solid var(--line-2);color:var(--ink);display:grid;place-items:center;font:500 .9rem var(--mono)}
.cmp .lbl{position:absolute;top:10px;font:500 .72rem/1 var(--mono);letter-spacing:.03em;padding:6px 9px;border-radius:99px;background:var(--bg)}
.cmp .lbl.b{left:10px;color:var(--no)}
.cmp .lbl.a{right:10px;color:var(--calm)}
.cmp input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none}
.cmp:focus-within{outline:2px solid var(--calm);outline-offset:2px}

/* Commands and patches */
.btn{font:500 .75rem/1 var(--mono);color:var(--read);background:var(--panel-2);border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;min-height:32px;cursor:pointer}
.btn:hover{color:var(--ink);border-color:var(--faint)}
.btn:focus-visible{outline:2px solid var(--calm);outline-offset:2px}
.cmd{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px 8px 8px 14px;margin:8px 0 18px}
.cmd code{flex:1;min-width:0;background:none;border:0;padding:0;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
details.patch{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin:8px 0 18px;overflow:hidden}
details.patch summary{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 8px 8px 14px;font:500 .82rem var(--mono);color:var(--read);cursor:pointer;list-style:none}
details.patch summary::-webkit-details-marker{display:none}
details.patch[open] summary{border-bottom:1px solid var(--line)}
pre.diff{margin:0;padding:10px 0;overflow-x:auto;font:400 .82rem/1.6 var(--mono)}
pre.diff .l{display:block;padding:0 14px;white-space:pre}
.l.add{color:var(--calm);background:var(--calm-bg)}
.l.del{color:var(--no);background:var(--no-bg)}
.l.hunk{color:var(--faint)}
.l.meta{color:var(--dim)}
.l.ctx{color:var(--read)}
.hex{font:500 .8em var(--mono);padding:.1em .45em;border-radius:5px;border:1px solid var(--line-2);white-space:nowrap}

/* Reportly addition: live status chip and nav markers */
nav.side .status{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 8px;margin:-14px 0 22px;padding:0 10px}
nav.side .status .state{display:flex;align-items:center;gap:8px;font:500 .74rem/1.3 var(--mono);letter-spacing:.03em;color:var(--read);white-space:nowrap}
nav.side .status .state::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:var(--calm)}
nav.side .status[data-status="done"] .state::before{background:var(--dim)}
nav.side .status .when{grid-column:1 / -1;font-size:.8rem;color:var(--faint)}
nav.side .status .when:empty{display:none}
nav.side .status .pdf{min-height:26px;padding:6px 8px;font-size:.7rem}
nav.side ol a.pending{color:var(--faint)}
nav.side ol a.fresh span:last-child::after{content:"";display:inline-block;width:6px;height:6px;margin-left:8px;border-radius:50%;background:var(--calm);vertical-align:.1em}
main > section[id]:empty::before{content:attr(id);display:block;font:650 1.55rem/1.2 var(--sans);letter-spacing:-.015em;color:var(--faint)}
main > section[id][data-nav]:empty::before{content:attr(data-nav)}
main > section[id]:empty::after{content:"Pending";display:inline-block;margin-top:12px;font:500 .72rem/1 var(--mono);letter-spacing:.03em;padding:5px 8px;border-radius:99px;color:var(--dim);background:var(--panel-2)}

/* Reportly addition: checklist (one .check per item, usually one block each) */
.check{display:flex;align-items:flex-start;gap:12px;background:var(--panel);border:1px solid var(--line);border-top-width:0;padding:12px 16px;min-width:0}
:not(.check) + .check{border-top-width:1px;border-radius:14px 14px 0 0;margin-top:8px}
.check:not(:has(+ .check)){border-radius:0 0 14px 14px;margin-bottom:18px}
:not(.check) + .check:not(:has(+ .check)){border-radius:14px}
.check::before{content:"";flex:none;display:grid;place-items:center;width:18px;height:18px;margin-top:2px;border-radius:50%;border:1.5px solid var(--faint);font:700 11px/1 var(--sans)}
.check[data-state="doing"]::before{border-color:var(--warn);background:radial-gradient(circle,var(--warn) 0 3.5px,transparent 4px)}
.check[data-state="done"]::before{content:"\2713";border-color:var(--calm);background:var(--calm);color:var(--bg)}
.check[data-state="blocked"]::before{content:"\2715";border-color:var(--no);color:var(--no)}
.check > div{flex:1;min-width:0}
.check strong{display:block;font-weight:500;color:var(--ink)}
.check[data-state="done"] strong{color:var(--read)}
.check div > span{display:block;font-size:.88rem;color:var(--dim);margin-top:2px}

/* Reportly addition: activity log (one .log per entry) */
.log{display:grid;grid-template-columns:64px 14px minmax(0,1fr);gap:0 10px;align-items:baseline;padding:4px 0;font-size:.94rem;background:linear-gradient(var(--line-2),var(--line-2)) no-repeat 81px 0 / 1px 100%}
:not(.log) + .log{margin-top:8px}
.log:not(:has(+ .log)){margin-bottom:18px}
.log time{grid-column:1;white-space:nowrap;grid-row:1;font:500 .74rem var(--mono);font-variant-numeric:tabular-nums;color:var(--faint)}
.log::before{content:"";grid-column:2;grid-row:1;justify-self:center;align-self:center;width:7px;height:7px;border-radius:50%;background:var(--faint);box-shadow:0 0 0 3px var(--bg)}
.log[data-state="ok"]::before{background:var(--calm)}
.log[data-state="mid"]::before{background:var(--warn)}
.log[data-state="no"]::before{background:var(--no)}
.log > span{grid-column:3;grid-row:1;min-width:0}

/* Reportly addition: test results */
.tests .sum{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.pill.skip{color:var(--dim);background:var(--panel-2)}
.tests .grid{display:flex;flex-wrap:wrap;gap:3px}
.tests .grid i{width:12px;height:12px;border-radius:3px;background:var(--calm)}
.tests .grid i.fail{background:var(--no)}
.tests .grid i.skip{background:var(--line-2)}
.tests details{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.tests summary{cursor:pointer;color:var(--ink);font-size:.92rem;overflow-wrap:anywhere}
.tests details pre{margin:8px 0 0;padding:10px 12px;max-height:280px;overflow:auto;font:400 .8rem/1.55 var(--mono);color:var(--no);white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:10px}

/* Reportly addition: gallery, lightbox, tabs */
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:8px 0 18px}
.gallery figure{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px;min-width:0}
.gallery img{display:block;width:100%;height:auto;border-radius:8px}
.gallery figcaption{font-size:.84rem;color:var(--dim);padding:8px 4px 2px}
img.zoomable{cursor:zoom-in}
dialog.lightbox{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:rgba(5,5,6,.95);color:var(--ink)}
dialog.lightbox::backdrop{background:rgba(5,5,6,.95)}
.lightbox .stage{position:absolute;inset:56px 64px 64px;display:grid;place-items:center;overflow:auto}
.lightbox .stage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;cursor:zoom-in}
.lightbox.full .stage{display:block}
.lightbox.full .stage img{display:block;max-width:none;max-height:none;margin:0 auto;cursor:zoom-out}
.lightbox .lb-cap{position:absolute;left:16px;right:16px;bottom:18px;margin:0;text-align:center;font-size:.9rem;color:var(--read)}
.lightbox .lb-close{position:absolute;top:12px;right:16px}
.lightbox .lb-prev,.lightbox .lb-next{position:absolute;top:50%;width:40px;height:40px;margin-top:-20px;font-size:1.2rem}
.lightbox .lb-prev{left:12px}
.lightbox .lb-next{right:12px}
.lightbox.single .lb-prev,.lightbox.single .lb-next{display:none}
.tabs{margin:8px 0 18px;min-width:0}
.tablist{display:flex;gap:4px;margin-bottom:14px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--line)}
.tablist button{margin-bottom:-1px;padding:8px 12px;font:500 .88rem var(--sans);white-space:nowrap;color:var(--dim);background:none;border:0;border-bottom:2px solid transparent;cursor:pointer}
.tablist button:hover{color:var(--ink)}
.tablist button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--calm)}
.tablist button:focus-visible{outline:2px solid var(--calm);outline-offset:-2px;border-radius:6px}
.tabs > [data-tab][hidden]{display:none}

/* Reportly addition: code excerpts, terminal output, captioned tables */
.code,.term{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin:8px 0 18px;overflow:hidden;min-width:0}
.code .head,.term .head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 8px 8px 14px;border-bottom:1px solid var(--line);font:500 .82rem var(--mono);color:var(--read)}
.code .head span,.term .head span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.code pre,.term pre{margin:0;max-height:520px;overflow:auto;font:400 .82rem/1.6 var(--mono);color:var(--read)}
.code pre{padding:10px 0}
.code .l{display:inline-block;min-width:100%;padding-right:14px;white-space:pre}
.code .l::before{content:attr(data-n);display:inline-block;width:4.2em;padding-right:1.2em;text-align:right;color:var(--faint);user-select:none}
.code .l.mark{background:var(--warn-bg)}
.term pre{padding:12px 14px;white-space:pre;background:var(--bg)}
.term .c-ok{color:var(--calm)}
.term .c-mid{color:var(--warn)}
.term .c-no{color:var(--no)}
.term .c-ink{color:var(--ink)}
.term .c-dim{color:var(--faint)}
.term b{font-weight:600}
figure.table{margin:8px 0 18px}
figure.table figcaption{margin:0 0 10px}
figure.table figcaption strong{display:block;font-size:1rem;line-height:1.35}
figure.table figcaption span{display:block;font-size:.84rem;color:var(--dim);margin-top:2px}

/* Reportly addition: comments */
.cmt{display:inline-flex;align-items:center;gap:4px;vertical-align:middle;margin-left:8px;padding:3px 6px;font:500 .72rem/1 var(--mono);letter-spacing:0;color:var(--faint);background:none;border:1px solid transparent;border-radius:7px;cursor:pointer;opacity:0;transition:opacity .12s}
.cmt[data-count]{opacity:1;color:var(--dim)}
.cmt[data-count]::after{content:attr(data-count)}
:is(h1,h2,[data-item],.top):hover > .cmt,.cmt:focus-visible{opacity:1}
.cmt:hover{color:var(--ink);background:var(--panel-2);border-color:var(--line-2)}
.cmt:focus-visible{outline:2px solid var(--calm);outline-offset:1px}
@media (hover:none){.cmt{opacity:.75}}
[data-item]{position:relative}
[data-item] > .cmt{position:absolute;top:8px;right:8px;margin:0}
.check > .cmt{position:static;align-self:center;margin:0 0 0 auto}
.card .top:has(> .cmt){justify-content:flex-start}
.card .top:has(> .cmt) > h3{margin-right:auto}
.card .top > .cmt{margin:0}
.cmt-pop{position:absolute;z-index:20;width:min(360px,calc(100vw - 32px));padding:12px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.5)}
.cmt-pop[hidden],.cmt-list[hidden]{display:none}
.cmt-list{display:grid;gap:12px;max-height:280px;overflow-y:auto;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.cmt-list .c.agent{border-left:2px solid var(--calm);padding-left:10px}
.cmt-list .who{display:flex;gap:8px;align-items:baseline}
.cmt-list .who b{font-size:.86rem;font-weight:600;color:var(--ink)}
.cmt-list time{font:500 .7rem var(--mono);color:var(--faint)}
.cmt-list p{margin:2px 0 0;font-size:.9rem;color:var(--read);white-space:pre-wrap;overflow-wrap:anywhere}
.cmt-form textarea,.cmt-form input{width:100%;padding:8px 10px;font:inherit;font-size:.92rem;color:var(--ink);background:var(--panel);border:1px solid var(--line-2);border-radius:9px}
.cmt-form textarea{display:block;min-height:72px;resize:vertical}
.cmt-form textarea:focus-visible,.cmt-form input:focus-visible{outline:2px solid var(--calm);outline-offset:1px}
.cmt-form .row{display:flex;gap:8px;margin-top:8px}
.cmt-form .row input{flex:1;min-width:0}
.cmt-err{margin:8px 0 0;font-size:.84rem;color:var(--no)}

footer{margin-top:72px;padding-top:20px;border-top:1px solid var(--line);font-size:.85rem;color:var(--faint)}

@media (max-width:900px){
  .shell{grid-template-columns:minmax(0,1fr);gap:0;padding:0 16px}
  nav.side{height:auto;padding:8px 16px;margin:0 -16px;background:var(--bg);z-index:5;border-bottom:1px solid var(--line);overflow:visible}
  nav.side .brand{display:none}
  nav.side ol{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}
  nav.side ol::-webkit-scrollbar{display:none}
  nav.side ol a{display:flex;gap:8px;white-space:nowrap;padding:8px 10px}
  nav.side{display:flex;align-items:center;gap:8px}
  nav.side ol{flex:1;min-width:0}
  nav.side .status{order:2;display:flex;flex:none;margin:0;padding:0 2px 0 12px;border-left:1px solid var(--line)}
  nav.side .status .when,nav.side .status .pdf{display:none}
  main{padding-top:36px}
  section{padding-top:56px;scroll-margin-top:64px}
  .verdict{grid-template-columns:1fr}
}
@media (max-width:720px){
  .grid-2{grid-template-columns:1fr}
  .lightbox .stage{inset:56px 8px 64px}
  .lightbox .lb-prev,.lightbox .lb-next{top:auto;bottom:10px;margin:0}
  .diagram{padding:16px}
  .chart{height:260px}
  .chart.tall{height:340px}
}
@media (max-width:520px){
  body{font-size:16px}
  .card .top{flex-direction:column;gap:8px}
  .phase{grid-template-columns:minmax(0,1fr);gap:4px}
}

/* Reportly addition: Save PDF prints the page as it looks, on full-bleed dark pages */
@media print{
  @page{margin:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html{scroll-behavior:auto}
  .shell{display:block;max-width:none;padding:0}
  nav.side,.cmt,.cmt-pop,dialog,.btn,.tablist,.cmp input,.cmp .knob{display:none !important}
  main{max-width:none;padding:14mm 16mm;-webkit-box-decoration-break:clone;box-decoration-break:clone}
  section{padding-top:32px}
  main > section[id]:empty{display:none}
  .card,.diagram,figure,.phase,.qs li,.check,.log,.cmd,.verdict div,tr,img,video{break-inside:avoid}
  h2,h3,figcaption,.group{break-after:avoid}
  .tabs > [data-tab][hidden]{display:block !important}
  .tabs > [data-tab]::before{content:attr(data-tab);display:block;margin:16px 0 8px;font:500 .78rem var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
  .code pre,.term pre,.tests details pre,.tablewrap{max-height:none;overflow:visible}
  .code .l,.term pre,pre.diff .l{white-space:pre-wrap;word-break:break-all}
}
`;
