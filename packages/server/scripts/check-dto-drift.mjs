#!/usr/bin/env node
/**
 * DTO ↔ shared 类型一致性检查（`npm run check:dto-drift`，CI 执行）。
 *
 * 对 `src/lib/dtos/*.ts` 中每个与 `@zenith/shared` 同名的实体 DTO（`XxxDTO` ↔ `Xxx`），
 * 生成双向可赋值性探针并用 tsc 求值：
 *   - d2s：服务端 DTO 输出必须能赋给 shared 类型（前端依赖的形状）
 *   - s2d：shared 类型必须能赋给 DTO 输出
 * 已知漂移登记在 `scripts/dto-drift.baseline.json`，只允许减少、不允许新增。
 * 契约化（shared 单一 schema）完成的域没有独立 DTO，自然不在检查范围内。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dtoDir = path.join(serverDir, 'src/lib/dtos');
const sharedSrc = path.resolve(serverDir, '../shared/src');
const probeFile = path.join(serverDir, 'src/__dto-drift.generated.ts');
const tsconfigFile = path.join(serverDir, 'tsconfig.dto-drift.generated.json');
const baselineFile = path.join(serverDir, 'scripts/dto-drift.baseline.json');
const update = process.argv.includes('--update-baseline');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** shared 导出的类型名 → 所属域 */
function collectSharedTypes() {
  const map = new Map();
  for (const domain of fs.readdirSync(sharedSrc)) {
    const dir = path.join(sharedSrc, domain);
    if (!fs.statSync(dir).isDirectory() || domain === 'seed') continue;
    for (const f of walk(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/^export (?:interface|type) (\w+)\b/gm)) {
        if (!map.has(m[1])) map.set(m[1], domain);
      }
    }
  }
  return map;
}

function collectProbes(sharedTypes) {
  const probes = [];
  const seen = new Set();
  if (!fs.existsSync(dtoDir)) return probes;
  for (const f of fs.readdirSync(dtoDir)) {
    if (!f.endsWith('.ts') || f.startsWith('_') || f === 'index.ts') continue;
    for (const m of fs.readFileSync(path.join(dtoDir, f), 'utf8').matchAll(/^export const (\w+)DTO\b/gm)) {
      const base = m[1];
      const domain = sharedTypes.get(base);
      if (!domain || seen.has(base)) continue;
      seen.add(base);
      probes.push({ dto: `${base}DTO`, base, domain, file: f.replace(/\.ts$/, '') });
    }
  }
  return probes;
}

function writeProbeFile(probes) {
  const lines = ["import { z } from 'zod';"];
  for (const p of probes) lines.push(`import { ${p.dto} } from './lib/dtos/${p.file}';`);
  for (const p of probes) lines.push(`import type { ${p.base} as ${p.base}__s } from '@zenith/shared/${p.domain}';`);
  for (const p of probes) {
    lines.push(`export const d2s__${p.base}: ${p.base}__s = null as unknown as z.infer<typeof ${p.dto}>;`);
    lines.push(`export const s2d__${p.base}: z.infer<typeof ${p.dto}> = null as unknown as ${p.base}__s;`);
  }
  fs.writeFileSync(probeFile, lines.join('\n') + '\n');
  fs.writeFileSync(tsconfigFile, JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: { noEmit: true, composite: false, incremental: false, declaration: false, declarationMap: false, sourceMap: false, tsBuildInfoFile: null },
    include: ['src/__dto-drift.generated.ts'],
    exclude: [],
    references: [],
  }, null, 2));
  return lines;
}

function runTsc(lines) {
  const tsc = path.join(serverDir, '../../node_modules/.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  const result = spawnSync(tsc, ['-p', tsconfigFile, '--pretty', 'false'], { cwd: serverDir, encoding: 'utf8', shell: process.platform === 'win32' });
  const failures = new Set();
  for (const line of `${result.stdout}\n${result.stderr}`.split('\n')) {
    const m = line.match(/__dto-drift\.generated\.ts\((\d+),\d+\): error TS/);
    if (!m) continue;
    const decl = lines[Number(m[1]) - 1] ?? '';
    const name = decl.match(/^export const ((?:d2s|s2d)__\w+):/)?.[1];
    if (name) failures.add(name);
  }
  return [...failures].sort();
}

function cleanup() {
  for (const f of [probeFile, tsconfigFile]) if (fs.existsSync(f)) fs.unlinkSync(f);
}

const sharedTypes = collectSharedTypes();
const probes = collectProbes(sharedTypes);
console.log(`DTO ↔ shared 同名实体 ${probes.length} 对`);
if (probes.length === 0) {
  console.log('无独立 DTO，跳过。');
  process.exit(0);
}

let failures;
try {
  failures = runTsc(writeProbeFile(probes));
} finally {
  cleanup();
}

const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : [];
if (update) {
  fs.writeFileSync(baselineFile, JSON.stringify(failures, null, 2) + '\n');
  console.log(`基线已更新：${failures.length} 处漂移`);
  process.exit(0);
}

const baselineSet = new Set(baseline);
const added = failures.filter((f) => !baselineSet.has(f));
const fixed = baseline.filter((f) => !failures.includes(f));
console.log(`当前漂移 ${failures.length} 处，基线 ${baseline.length} 处`);
if (fixed.length) {
  console.error(`以下漂移已修复，请从基线移除（或运行 --update-baseline）：\n  ${fixed.join('\n  ')}`);
}
if (added.length) {
  console.error(`新增漂移（DTO 与 shared 类型不一致）：\n  ${added.join('\n  ')}`);
}
process.exit(added.length || fixed.length ? 1 : 0);
