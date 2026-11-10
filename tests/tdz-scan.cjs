/* Finds let or const names used before their declaration in the same block (the bug that broke Add VFR checkpoints
   on Nov 8). Run: node tests/tdz-scan.cjs  (needs acorn: npm i acorn). Exits 1 when it finds any. */
let acorn; try { acorn = require('acorn'); } catch (e) { acorn = require('/tmp/claude-0/bsite/node_modules/acorn'); } const fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..'); let hits = 0;
function names(pat, out) { if (!pat) return; if (pat.type === 'Identifier') out.push(pat.name); else if (pat.type === 'ObjectPattern') pat.properties.forEach(p => names(p.value || p.argument, out)); else if (pat.type === 'ArrayPattern') pat.elements.forEach(e => names(e, out)); else if (pat.type === 'AssignmentPattern') names(pat.left, out); else if (pat.type === 'RestElement') names(pat.argument, out); }
function declares(node, name) {
  const has = (decl) => decl && decl.type === 'VariableDeclaration' && decl.declarations.some(d => { const ns = []; names(d.id, ns); return ns.includes(name); });
  if (node.type === 'BlockStatement') return node.body.some(has) || node.body.some(s => s.type === 'FunctionDeclaration' && s.id && s.id.name === name);
  if (node.type === 'ForStatement') return has(node.init);
  if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') return has(node.left);
  if (node.type === 'CatchClause') { const ns = []; names(node.param, ns); return ns.includes(name); }
  if (node.type === 'SwitchStatement') return node.cases.some(c => c.consequent.some(has));
  return false;
}
function refs(node, name, end, out, parent, key) {
  if (!node || typeof node.type !== 'string') return; if (node.start >= end) return;
  if (/Function/.test(node.type)) return; // deferred execution
  if (declares(node, name)) return; // shadowed in a nested scope
  if (node.type === 'Identifier' && node.name === name) {
    if (parent && parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return;
    if (parent && parent.type === 'Property' && key === 'key' && !parent.computed) return;
    out.push(node); return; }
  for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach(c => c && refs(c, name, end, out, node, k)); else if (v && typeof v.type === 'string') refs(v, name, end, out, node, k); }
}
function visit(node, file, src) {
  if (!node || typeof node.type !== 'string') return;
  const body = node.type === 'BlockStatement' || node.type === 'Program' ? node.body : null;
  if (body) for (const st of body) if (st.type === 'VariableDeclaration' && st.kind !== 'var') for (const d of st.declarations) { const ns = []; names(d.id, ns); for (const n of ns) { const out = []; for (const prev of body) { if (prev.start >= d.start) break; refs(prev, n, d.start, out, null, null); } if (d.init) { const o2 = []; refs(d.init, n, d.init.end, o2, null, null); out.push(...o2); } for (const r of out) { hits++; console.log(`${file}:${src.slice(0, r.start).split('\n').length} '${n}' used before its declaration`); } } }
  for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach(c => c && visit(c, file, src)); else if (v && typeof v.type === 'string') visit(v, file, src); }
}
for (const f of fs.readdirSync(dir).filter(x => /\.js$/.test(x))) { const src = fs.readFileSync(path.join(dir, f), 'utf8'); if (src.split('\n').some(l => l.length > 20000)) continue; let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e2) { console.log(f, 'parse error', e2.message); continue; } } visit(ast, f, src); }
console.log('files scanned, hits', hits); process.exit(hits ? 1 : 0);
