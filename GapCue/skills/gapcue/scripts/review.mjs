#!/usr/bin/env node
// GapCue: build a review page for a story into a permanent reviews folder, keep versions,
// serve all reviews with a history page, and save decisions to disk.
//
//   node review.mjs <story.json> --root <reviews-dir> [--mode new|replace] [--port 8765] [--no-open] [--build-only]
//   node review.mjs <story.json> --single-file [--out <dir>]                  one self-contained HTML (apps / no server)
//   node review.mjs --serve --root <reviews-dir> [--port 8765] [--no-open]      reopen history / old reviews
//   node review.mjs --status <story.json> --root <reviews-dir>                  does this story already have reviews?
//
// Layout:  <root>/index.html                 history of all reviews (static, works without the server)
//          <root>/<ID>/v<N>/index.html       the review page
//          <root>/<ID>/v<N>/story.json       story + findings
//          <root>/<ID>/v<N>/state.json       decisions, own findings, BA comment (state.js = same data for file:// opening)
//          <root>/<ID>/v<N>/img/             screenshots
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const valueFlags = new Set(["--root", "--mode", "--port", "--status", "--out"]);
const flag = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args[i + 1]; };
const has = name => args.includes(name);
const positional = args.filter((a, i) => !a.startsWith("--") && !valueFlags.has(args[i - 1]));
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(flag("--root", path.join(os.homedir(), "gapcue-reviews")));
const slugOf = d => String(d.id || d.title || "story").trim().replace(/[^\w-]+/g, "-");
const versionsOf = dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory()
  ? fs.readdirSync(dir).map(n => /^v(\d+)$/.exec(n)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b) : [];
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };

/* ---------- version + update notice (like npm / vercel: at most one small check a day, never blocks, sends no story data) ---------- */
const SEMVER = /^\d+\.\d+\.\d+$/;
const VERSION = (fs.readFileSync(path.join(here, "..", "SKILL.md"), "utf8").match(/^\s+version:\s*"?(\d+\.\d+\.\d+)"?\s*$/m) || [])[1] || "0.0.0";
const LATEST_URL = "https://raw.githubusercontent.com/Red-Cloud2000/skills/main/GapCue/.claude-plugin/plugin.json";
const newer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
async function updateNotice() {
  const env = process.env;
  if (env.GAPCUE_NO_UPDATE_CHECK || env.NO_UPDATE_NOTIFIER || env.CI) return;
  const cacheFile = path.join(os.homedir(), ".gapcue", "update-check.json");
  let c = readJson(cacheFile) || {};
  if (!(Date.now() - (c.checkedAt || 0) < 864e5)) {
    let latest = c.latest;
    try {
      const r = await fetch(LATEST_URL, { signal: AbortSignal.timeout(1500) });
      if (r.ok) latest = (await r.json()).version;
    } catch {} // offline or slow: try again tomorrow
    c = { checkedAt: Date.now(), latest };
    try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); writeAtomic(cacheFile, JSON.stringify(c)); } catch {}
  }
  // only a plain version number is ever printed, never other text from the network
  if (typeof c.latest === "string" && SEMVER.test(c.latest) && newer(c.latest, VERSION)) console.log(`update available: GapCue ${VERSION} → ${c.latest}  (what's new: https://github.com/Red-Cloud2000/skills/releases)
  Claude Code:   claude plugin update gapcue@red-cloud-skills   (then start a new session)
  other agents:  npx skills update
  manual / ZIP:  download the latest release and replace the old copy`);
}

// write via a temp file + rename so a crash never leaves half a file
function writeAtomic(file, text) { const tmp = file + ".tmp"; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }
function writeState(dir, state) {
  writeAtomic(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
  writeAtomic(path.join(dir, "state.js"), "window.__REVIEW_STATE__ = " + JSON.stringify(state).replace(/</g, "\\u003c") + ";\n");
}

/* ---------- story → page ---------- */
function loadStory(inputFile) {
  const data = readJson(inputFile) || die("Cannot read story JSON: " + inputFile);
  return { data, inputDir: path.dirname(path.resolve(inputFile)) };
}
// rough anchor check (tags = word breaks, like the page); misses show under "General findings"
function checkAnchors(data) {
  const flat = h => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").toLowerCase();
  const storyText = (data.sections || []).map(s => flat(s.html)).join(" | ");
  const all = (data.findings || []).flatMap(f => (f.anchors || []).map(a => ({ id: f.id, a, t: a.text.replace(/\s+/g, " ").trim().toLowerCase() })));
  for (const x of all) if (!storyText.includes(x.t)) console.warn(`anchor not found [${x.id}]: ${x.a.text}`);
  // highlights can't nest: text inside another finding's highlight is never found on the page
  for (const x of all) for (const y of all)
    if (x !== y && x.id !== y.id && y.t.includes(x.t) && (!x.a.in || !y.a.in || x.a.in === y.a.in))
      console.warn(`anchor overlaps [${x.id}] inside [${y.id}]: "${x.a.text}". Give each finding its own words of the story (or an "in" id).`);
}
// images: copy next to the page (imgDir) or embed as data URIs (imgDir = null)
function resolveImages(data, inputDir, imgDir) {
  for (const im of data.images || []) {
    if (!im.path) continue;
    const src = path.resolve(inputDir, im.path);
    if (!fs.existsSync(src)) { console.warn("image not found, skipped:", src); continue; }
    if (imgDir) {
      const name = path.basename(src).replace(/[^\w.-]+/g, "_");
      fs.copyFileSync(src, path.join(imgDir, name));
      im.src = "img/" + name;
    } else {
      im.src = `data:${mime[path.extname(src).toLowerCase()] || "application/octet-stream"};base64,${fs.readFileSync(src).toString("base64")}`;
    }
    delete im.path;
  }
  data.images = (data.images || []).filter(im => im.src);
}
function renderPage(data) {
  data.gapcue = VERSION;
  if (process.env.GAPCUE_NO_UPDATE_CHECK || process.env.NO_UPDATE_NOTIFIER) data.noUpdateCheck = true;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return fs.readFileSync(path.join(here, "..", "assets", "template.html"), "utf8").replace("/*__DATA__*/", () => json);
}

/* ---------- history page ---------- */
function writeHistory() {
  fs.mkdirSync(root, { recursive: true });
  const rows = [];
  for (const slug of fs.readdirSync(root)) {
    const vs = versionsOf(path.join(root, slug));
    if (!vs.length) continue;
    const latest = vs[vs.length - 1];
    const dir = path.join(root, slug, "v" + latest);
    const story = readJson(path.join(dir, "story.json")) || {};
    const st = readJson(path.join(dir, "state.json")) || { status: {} };
    const findings = (story.findings || []).length + (st.custom || []).length;
    const vals = Object.values(st.status || {});
    const ok = vals.filter(v => v === "approved").length, oos = vals.filter(v => v === "oos").length;
    const changed = Math.max(st.updatedAt || 0, fs.statSync(path.join(dir, "story.json")).mtimeMs);
    rows.push({ slug, story, vs, latest, findings, ok, oos, open: Math.max(0, findings - ok - oos), changed });
  }
  rows.sort((a, b) => b.changed - a.changed);
  const body = rows.length ? rows.map(r => `
    <a class="row" href="${esc(r.slug)}/v${r.latest}/index.html">
      <span class="id">${esc(r.story.id || r.slug)}</span>
      <span class="t">${esc(r.story.title || "")}${r.story.titleAr ? ` <span lang="ar">${esc(r.story.titleAr)}</span>` : ""}</span>
      <span class="v">v${r.latest}${r.vs.length > 1 ? ` <small>(${r.vs.length} versions)</small>` : ""}</span>
      <span class="n"><b class="ok">${r.ok}</b> approved · <b class="oos">${r.oos}</b> out of scope · <b>${r.open}</b> open</span>
      <span class="d">${new Date(r.changed).toISOString().slice(0, 16).replace("T", " ")}</span>
    </a>${r.vs.length > 1 ? `<div class="older">Older: ${r.vs.slice(0, -1).reverse().map(v => `<a href="${esc(r.slug)}/v${v}/index.html">v${v}</a>`).join(" · ")}</div>` : ""}`).join("")
    : `<p class="empty">No reviews yet. Run GapCue on a story and it will appear here.</p>`;
  writeAtomic(path.join(root, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>GapCue Reviews</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
:root{--bg:#f3f7f8;--surface:#fff;--ink:#0d2233;--muted:#566978;--line:#d7e2e6;--accent:#0f7f88;--ok:#167a49;--oos:#6f7d89}
@media (prefers-color-scheme:dark){:root{--bg:#0a161e;--surface:#0f202b;--ink:#e4edf1;--muted:#93a6b3;--line:#21394a;--accent:#3bbcc5;--ok:#53cc8f;--oos:#8c9aa6;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "IBM Plex Sans","IBM Plex Sans Arabic",system-ui,sans-serif;padding:40px 16px}
main{max-width:860px;margin:auto;display:grid;gap:10px}
h1{font:700 2.2rem/1.1 "Bricolage Grotesque",system-ui,sans-serif;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 18px;font-size:.9rem}.sub code{font:500 .8rem "IBM Plex Mono",monospace}
.row{display:grid;grid-template-columns:110px 1fr auto;gap:4px 16px;align-items:baseline;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;color:inherit;text-decoration:none;transition:border-color .2s}
.row:hover{border-color:var(--accent)}
.id{font:500 .8rem "IBM Plex Mono",monospace;color:var(--accent)}.t{font-weight:600;min-width:0}.t [lang=ar]{color:var(--muted);font-weight:400}
.v{font:500 .78rem "IBM Plex Mono",monospace;color:var(--muted);text-align:right}.v small{font-size:.7rem}
.n{grid-column:2;font-size:.82rem;color:var(--muted)}.n .ok{color:var(--ok)}.n .oos{color:var(--oos)}.n b{color:var(--ink)}
.d{font:500 .72rem "IBM Plex Mono",monospace;color:var(--muted);text-align:right}
.older{font-size:.78rem;color:var(--muted);padding:0 16px 6px 142px}.older a{color:var(--accent)}
.empty{background:var(--surface);border:1px dashed var(--line);border-radius:12px;padding:20px;color:var(--muted)}
@media (max-width:600px){.row{grid-template-columns:1fr auto}.t,.n{grid-column:1/-1}.older{padding-left:16px}}
</style></head><body><main>
<h1>GapCue reviews</h1>
<p class="sub">${rows.length} ${rows.length === 1 ? "story" : "stories"} · folder <code>${esc(root)}</code></p>
${body}
</main></body></html>`);
}

/* ---------- build one review into the reviews folder ---------- */
function build(inputFile) {
  const { data, inputDir } = loadStory(inputFile);
  const slug = slugOf(data);
  const storyDir = path.join(root, slug);
  const vs = versionsOf(storyDir);
  const mode = flag("--mode");
  if (vs.length && !["new", "replace"].includes(mode))
    die(`"${slug}" already has ${vs.length} version(s) in ${storyDir}. Ask the user, then pass --mode new (keep old, add v${vs[vs.length - 1] + 1}) or --mode replace (overwrite v${vs[vs.length - 1]}).`, 3);

  const prevVersion = vs[vs.length - 1];
  const version = !vs.length ? 1 : mode === "new" ? prevVersion + 1 : prevVersion;
  const dir = path.join(storyDir, "v" + version);
  // replace: keep the old decisions next to the new version as state.prev.json (never lose them silently)
  const replaced = mode === "replace" ? readJson(path.join(dir, "state.json")) : null;
  const oldFindings = mode === "replace" ? (readJson(path.join(dir, "story.json")) || {}).findings || [] : [];
  if (mode === "replace") fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "img"), { recursive: true });
  if (replaced) writeAtomic(path.join(dir, "state.prev.json"), JSON.stringify(replaced, null, 2));

  resolveImages(data, inputDir, path.join(dir, "img"));
  data.version = version;
  data.reviewedAt = new Date().toISOString().slice(0, 10);
  checkAnchors(data);

  // new version or replace: carry over decisions and rewordings for findings that still exist, and the reviewer's
  // own findings (re-anchored by the page). A hand-edited comment is kept when the findings did not change.
  const ids = new Set((data.findings || []).map(f => f.id));
  const prev = mode === "new" ? readJson(path.join(storyDir, "v" + prevVersion, "state.json")) : replaced;
  const custom = prev && Array.isArray(prev.custom) ? prev.custom : [];
  for (const c of custom) ids.add(c.id);
  const pick = obj => Object.fromEntries(Object.entries(obj && typeof obj === "object" ? obj : {}).filter(([k]) => ids.has(k)));
  const status = pick(prev?.status), qEdit = pick(prev?.qEdit);
  const sameFindings = prev && mode === "replace" && JSON.stringify(oldFindings) === JSON.stringify(data.findings || []);
  const comment = sameFindings && prev.dirty ? prev.comment : null;
  // updatedAt stays the old one: a browser copy edited after the last save to disk is newer and still wins on load
  writeState(dir, { schema: 2, status, custom, qEdit, mode: "all", cur: 0, comment, dirty: !!comment, updatedAt: prev?.updatedAt || 0 });

  writeAtomic(path.join(dir, "story.json"), JSON.stringify(data, null, 2));
  writeAtomic(path.join(dir, "index.html"), renderPage(data));
  writeHistory();
  const carried = prev ? `, ${mode === "new" ? "carried over from v" + prevVersion : "kept"}: ${Object.keys(status).length} decision(s), ${custom.length} own finding(s), ${Object.keys(qEdit).length} reworded question(s)` : "";
  console.log(`saved: ${path.join(dir, "index.html")}  (v${version}${carried}${replaced ? "; a copy of the old decisions is in state.prev.json" : ""})`);
  return `${slug}/v${version}/index.html`;
}

/* ---------- one self-contained HTML (Claude / ChatGPT apps, or no server) ---------- */
function buildSingle(inputFile) {
  const { data, inputDir } = loadStory(inputFile);
  resolveImages(data, inputDir, null);
  data.singleFile = true;
  data.reviewedAt = new Date().toISOString().slice(0, 10);
  checkAnchors(data);
  const out = path.resolve(flag("--out", "."));
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, slugOf(data) + "-review.html");
  writeAtomic(file, renderPage(data));
  console.log("saved: " + file);
}

/* ---------- server ---------- */
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ...mime };

function openBrowser(url) {
  if (has("--no-open")) return;
  const [cmd, cmdArgs] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).unref();
}

function serve(page) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    if (rel === "__gapcue") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ root })); }
    // save decisions: PUT <ID>/v<N>/state.json, only from this server's own pages
    if (req.method === "PUT") {
      const port = server.address().port;
      const origin = req.headers.origin;
      if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) { res.writeHead(403); return res.end("Forbidden origin"); }
      const m = /^([\w-]+)\/v(\d+)\/state\.json$/.exec(rel);
      const dir = m && path.join(root, m[1], "v" + m[2]);
      if (!m || !fs.existsSync(dir)) { res.writeHead(404); return res.end(); }
      let buf = "";
      req.on("data", c => { buf += c; if (buf.length > 2e6) req.destroy(); });
      req.on("end", () => {
        try {
          const st = JSON.parse(buf);
          if (!st || typeof st !== "object" || Array.isArray(st)) throw 0;
          writeState(dir, st); res.writeHead(204); res.end();
        } catch { res.writeHead(400); res.end("Invalid JSON"); }
      });
      return;
    }
    if (rel === "" || rel === "index.html") writeHistory(); // always fresh
    let file = path.join(root, rel || "index.html");
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });

  const port = Number(flag("--port", 8765));
  server.on("error", async e => {
    if (e.code !== "EADDRINUSE") throw e;
    // port busy: if it is already our server for the same folder, just open the page there
    try {
      const r = await fetch(`http://127.0.0.1:${port}/__gapcue`);
      const info = await r.json();
      if (path.resolve(info.root) === root) {
        const base = `http://127.0.0.1:${port}/`;
        console.log(`already serving ${root} at ${base}`);
        openBrowser(base + (page || ""));
        return process.exit(0);
      }
    } catch {}
    server.listen(0, "127.0.0.1"); // something else owns the port: use a free one
  });
  server.on("listening", () => {
    const base = `http://127.0.0.1:${server.address().port}/`;
    console.log(`serving ${root}\nhistory: ${base}\n${page ? "review:  " + base + page + "\n" : ""}(Ctrl+C to stop)`);
    openBrowser(base + (page || ""));
  });
  server.listen(port, "127.0.0.1");
}

/* ---------- main ---------- */
if (has("--status")) {
  const { data } = loadStory(flag("--status"));
  const vs = versionsOf(path.join(root, slugOf(data)));
  console.log(vs.length ? `exists: ${slugOf(data)} has ${vs.length} version(s): ${vs.map(v => "v" + v).join(", ")}` : `new: no reviews of ${slugOf(data)} in ${root}`);
} else if (has("--serve")) {
  writeHistory();
  serve(null);
  updateNotice().catch(() => {}); // after the server starts, so it never delays it
} else {
  if (!positional[0]) die("Usage: node review.mjs <story.json> --root <dir> [--mode new|replace] | <story.json> --single-file [--out <dir>] | --serve --root <dir> | --status <story.json> --root <dir>");
  if (has("--single-file")) buildSingle(positional[0]);
  else {
    const page = build(positional[0]);
    if (!has("--build-only")) serve(page);
    await updateNotice().catch(() => {});
  }
}
