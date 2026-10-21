/* AeroSignal build step (runs on Vercel at every deploy).
   Combines the app's scripts and stylesheets, in the order index.html lists them, into one
   minified script and one stylesheet with content hashed names, then writes the site to dist/.
   The service worker gets a cache name tied to that content, so every deploy updates phones cleanly.
   Nothing about the app itself changes: same code, same order, fewer and smaller files. */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "dist");
const SKIP = new Set(["node_modules", "dist", ".vercel", ".git", "build.mjs", "package.json", "package-lock.json", "vercel.json", ".vercelignore"]);
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);
const read = (p) => fs.readFileSync(path.join(ROOT, p.replace(/^\//, "")), "utf8");

let terser = null, acorn = null;
try { terser = await import("terser"); } catch { console.log("terser not available, bundling without minifying"); }
try { acorn = await import("acorn"); } catch {}

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (src === ROOT && SKIP.has(e.name)) continue;
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b);
  }
}

/* A module that only runs code (no shared top level names) is wrapped so a failure in it
   cannot stop the modules after it, the same isolation separate files gave. */
function hasTopDecls(code) {
  if (!acorn) return true;
  try {
    const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script" });
    return ast.body.some((n) => n.type === "VariableDeclaration" || n.type === "FunctionDeclaration" || n.type === "ClassDeclaration");
  } catch { return true; }
}

const html = read("index.html");
const SCRIPT_RE = /[ \t]*<script src="(\/[^"]+\.js)"><\/script>\r?\n?/g;
const CSS_RE = /[ \t]*<link rel="stylesheet" href="(\/[^"]+\.css)">\r?\n?/g;
const scripts = [...html.matchAll(SCRIPT_RE)].map((m) => m[1]);
const styles = [...html.matchAll(CSS_RE)].map((m) => m[1]);

let js = '"use strict";\n';
for (const s of scripts) {
  let code = read(s);
  const strip = code.replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use strict["'];?/, (m) => m.replace(/["']use strict["'];?/, ""));
  const name = path.basename(s, ".js");
  js += hasTopDecls(strip)
    ? `/* ${name} */\n${strip}\n;\n`
    : `/* ${name} */\ntry{\n${strip}\n}catch(e){console.error("AeroSignal module ${name} failed",e)}\n`;
}
if (terser) {
  try {
    const r = await terser.minify(js, { ecma: 2020, compress: { passes: 1 }, mangle: true, format: { comments: false } });
    if (r && r.code) js = r.code;
  } catch (e) { console.log("minify skipped:", e.message); }
}

let css = styles.map((s) => read(s)).join("\n");
css = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*\n+/g, "\n").replace(/^\s+/gm, "");

const jsName = `/app.${sha(js)}.js`;
const cssName = `/app.${sha(css)}.css`;

copyTree(ROOT, OUT);
fs.writeFileSync(path.join(OUT, jsName.slice(1)), js);
fs.writeFileSync(path.join(OUT, cssName.slice(1)), css);

let out = html;
let firstJs = true, firstCss = true;
out = out.replace(SCRIPT_RE, () => (firstJs ? ((firstJs = false), `<script src="${jsName}"></script>\n`) : ""));
out = out.replace(CSS_RE, () => (firstCss ? ((firstCss = false), `<link rel="stylesheet" href="${cssName}">\n`) : ""));
/* Fonts and the map library's stylesheet load without holding up the first paint. */
out = out.replace(/<link (href="https:\/\/fonts\.googleapis\.com[^"]+") rel="stylesheet">/, '<link $1 rel="stylesheet" media="print" onload="this.media=\'all\'">');
out = out.replace(/<link rel="stylesheet" (href="https:\/\/cdnjs\.cloudflare\.com\/[^"]+leaflet[^"]*\.css")>/, '<link rel="stylesheet" $1 media="print" onload="this.media=\'all\'">');
fs.writeFileSync(path.join(OUT, "index.html"), out);

if (fs.existsSync(path.join(ROOT, "sw.js"))) {
  let sw = read("sw.js");
  const bundled = new Set([...scripts, ...styles]);
  sw = sw.replace(/const SHELL = \[([\s\S]*?)\];/, (_, list) => {
    const items = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((u) => !bundled.has(u));
    items.splice(Math.min(2, items.length), 0, cssName, jsName);
    return `const SHELL = [${items.map((u) => JSON.stringify(u)).join(", ")}];`;
  });
  sw = sw.replace(/const CACHE = "[^"]*";/, `const CACHE = "aerosignal-shell-${sha(js + css + out)}";`);
  fs.writeFileSync(path.join(OUT, "sw.js"), sw);
}

// Public military mishap narratives as plain JSON, read by the AeroSignal AI connector (MCP edge function)
if (fs.existsSync(path.join(ROOT, "milmishaps.js"))) {
  const vm = await import("vm");
  const box = { window: {} };
  vm.runInNewContext(read("milmishaps.js"), box);
  fs.writeFileSync(path.join(OUT, "milmishaps.json"), JSON.stringify(box.window.AeroMilData || []));
}

console.log(`Bundled ${scripts.length} scripts into ${jsName} (${Math.round(js.length / 1024)} KB) and ${styles.length} stylesheets into ${cssName} (${Math.round(css.length / 1024)} KB)`);
