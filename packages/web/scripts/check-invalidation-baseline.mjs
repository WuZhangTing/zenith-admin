#!/usr/bin/env node
/**
 * mutation 失效粒度基线检查（S5 防回潮护栏）
 *
 * 只检查**域 hooks 中 mutation `onSuccess` 作用域内**的 `xxxKeys.all` 广播失效。
 *
 * 为什么不做全仓禁令：
 *  - `.all` 在别处是合法用法（批量覆盖、切租户、全量导入，以及 keys 定义本身）；
 *  - 页面的 `handleSearch` / `handleReset` 必须失效 `xxxKeys.lists` 才能保证
 *    「查询按钮兼具刷新语义」，与本规则无关，不得误伤。
 *
 * 因此采用「基线清单 + 只减不增」：已知的历史位置记录在 invalidation-baseline.json，
 * 新增会失败，已迁移的域回退也会失败（基线里没有它，等于新增）。
 *
 * 用法：
 *   node scripts/check-invalidation-baseline.mjs          # 校验
 *   node scripts/check-invalidation-baseline.mjs --update # 重新生成基线（迁移完一个域后执行）
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUERIES_DIR = join(ROOT, 'src', 'hooks', 'queries');
const BASELINE_PATH = join(ROOT, 'scripts', 'invalidation-baseline.json');

/**
 * 扫描一个域 hooks 文件，返回 mutation onSuccess 中出现的 `xxxKeys.all` 位置。
 *
 * 判定方式：找到 `onSuccess` 后按花括号配平截取其函数体，只在该范围内匹配
 * `Keys.all`。这样既不会命中 keys 定义（`all: [...]`），也不会命中页面里的
 * 查询/重置失效（不在域 hooks 文件中）。
 */
function scanFile(text) {
  const hits = [];
  const onSuccessRe = /onSuccess\s*:/g;
  let m;
  while ((m = onSuccessRe.exec(text))) {
    const body = extractCallbackBody(text, m.index + m[0].length);
    if (!body) continue;
    const allRe = /(\w+Keys)\.all\b/g;
    let hit;
    while ((hit = allRe.exec(body.source))) {
      hits.push({ factory: hit[1], line: lineOf(text, body.start + hit.index) });
    }
  }
  return hits;
}

/** 从 `onSuccess:` 之后截取回调函数体（支持箭头简写与花括号块） */
function extractCallbackBody(text, from) {
  const arrowIdx = text.indexOf('=>', from);
  if (arrowIdx === -1) return null;
  const braceIdx = text.indexOf('{', arrowIdx);
  const lineEnd = text.indexOf('\n', arrowIdx);

  // 箭头简写：onSuccess: () => qc.invalidateQueries(...)，取到本行结尾
  if (braceIdx === -1 || (lineEnd !== -1 && braceIdx > lineEnd)) {
    const stop = lineEnd === -1 ? text.length : lineEnd;
    return { source: text.slice(arrowIdx, stop), start: arrowIdx };
  }

  // 花括号块：按配平找到结束位置
  let depth = 0;
  for (let i = braceIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return { source: text.slice(braceIdx, i + 1), start: braceIdx };
    }
  }
  return null;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function collect() {
  const result = {};
  for (const name of readdirSync(QUERIES_DIR)) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
    const hits = scanFile(readFileSync(join(QUERIES_DIR, name), 'utf8'));
    if (hits.length > 0) result[name] = hits.length;
  }
  return result;
}

const current = collect();
const total = Object.values(current).reduce((s, n) => s + n, 0);

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`已更新基线：${Object.keys(current).length} 个文件，共 ${total} 处广播失效`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(`找不到基线文件 ${BASELINE_PATH}，请先执行 --update`);
  process.exit(1);
}

const problems = [];
for (const [file, count] of Object.entries(current)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) {
    problems.push(
      allowed === 0
        ? `${file}：新增 ${count} 处 mutation 广播失效（该文件已收敛或从未有过，不得回退）`
        : `${file}：广播失效由 ${allowed} 处增至 ${count} 处`,
    );
  }
}

if (problems.length > 0) {
  console.error('\n✖ mutation 失效粒度回退：\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    [
      '',
      '域 hooks 的 mutation onSuccess 应按真实副作用失效，而不是广播 xxxKeys.all —— ',
      '后者会把同根下的详情、统计、日志、下拉源一并打掉。',
      '参考 hooks/queries/positions.ts 与 cron-jobs.ts，规范见',
      '.agents/skills/zenith/references/crud-frontend.md 的「缓存一致性契约」。',
      '确需全域失效（批量覆盖、切租户、全量导入）请在注释写明理由，',
      '并执行 node scripts/check-invalidation-baseline.mjs --update 更新基线。',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const baselineTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
console.log(`✔ mutation 广播失效 ${total} 处（基线 ${baselineTotal}），未出现回退`);
