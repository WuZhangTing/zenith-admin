/**
 * 值层循环依赖检测（type-only 环运行时无害，不计入）
 *
 * 背景：ESM 循环 + 顶层求值（如 z.enum(CONST)）会触发 TDZ，
 * 表现为运行时 "Cannot convert undefined or null to object"。
 * madge --circular 无法区分 import / import type，故自建此检测。
 *
 * 用法：node scripts/check-value-cycles.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'packages/shared/src');

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) files.push(p);
  }
})(SRC);

const graph = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const deps = new Set();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    const spec = st.moduleSpecifier.text;
    if (!spec.startsWith('.')) continue;
    // 整条 import type 跳过；命名项全部 type-only 也跳过
    const clause = st.importClause;
    if (clause?.isTypeOnly) continue;
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      if (clause.namedBindings.elements.every((el) => el.isTypeOnly)) continue;
    }
    const resolved = path.resolve(path.dirname(file), spec) + '.ts';
    if (fs.existsSync(resolved)) deps.add(resolved);
    else {
      const idx = path.resolve(path.dirname(file), spec, 'index.ts');
      if (fs.existsSync(idx)) deps.add(idx);
    }
  }
  graph.set(file, deps);
}

const cycles = [];
const state = new Map();
const stack = [];
function dfs(node) {
  state.set(node, 1);
  stack.push(node);
  for (const dep of graph.get(node) ?? []) {
    if (state.get(dep) === 1) {
      cycles.push([...stack.slice(stack.indexOf(dep)), dep]);
    } else if (!state.has(dep)) dfs(dep);
  }
  stack.pop();
  state.set(node, 2);
}
for (const f of graph.keys()) if (!state.has(f)) dfs(f);

const rel = (p) => path.relative(SRC, p).replaceAll('\\', '/');
if (cycles.length) {
  console.error(`✗ 发现 ${cycles.length} 个值层循环依赖：`);
  for (const c of cycles) console.error('  ' + c.map(rel).join(' -> '));
  process.exit(1);
}
console.log(`✓ 无值层循环依赖（已扫描 ${files.length} 个文件）`);
