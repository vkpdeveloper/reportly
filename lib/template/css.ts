// The html-communication template stylesheet, copied verbatim. Do not restyle.
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
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
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

/* Phases and questions */
.phases{display:grid;gap:10px}
.phase{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
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

footer{margin-top:72px;padding-top:20px;border-top:1px solid var(--line);font-size:.85rem;color:var(--faint)}

@media (max-width:900px){
  .shell{grid-template-columns:minmax(0,1fr);gap:0;padding:0 16px}
  nav.side{height:auto;padding:8px 16px;margin:0 -16px;background:var(--bg);z-index:5;border-bottom:1px solid var(--line);overflow:visible}
  nav.side .brand{display:none}
  nav.side ol{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}
  nav.side ol::-webkit-scrollbar{display:none}
  nav.side ol a{display:flex;gap:8px;white-space:nowrap;padding:8px 10px}
  main{padding-top:36px}
  section{padding-top:56px;scroll-margin-top:64px}
  .verdict{grid-template-columns:1fr}
}
@media (max-width:720px){
  .grid-2{grid-template-columns:1fr}
  .diagram{padding:16px}
  .chart{height:260px}
  .chart.tall{height:340px}
}
@media (max-width:520px){
  body{font-size:16px}
  .card .top{flex-direction:column;gap:8px}
  .phase{grid-template-columns:1fr;gap:4px}
}
`;
