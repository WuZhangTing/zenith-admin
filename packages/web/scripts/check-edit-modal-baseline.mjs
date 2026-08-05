#!/usr/bin/env node
/**
 * 编辑弹窗样板基线检查（useEditModal 迁移防回潮护栏）
 *
 * 检查页面层手写的两处样板：
 *  1. `useRef<FormApi>` / `useRef<FormApi<T> | null>` —— 编辑弹窗自持表单实例
 *  2. `throw new Error('validation')` —— 校验失败中断提交
 *
 * 两者都应由 `@/hooks/useEditModal` 承担。手写它们不会报错、不会让测试变红
 * （详见 hooks/useEditModal.ts 文件头列出的四条契约），只能靠人工逐页 review 发现，
 * 因此在这里拦住。
 *
 * 为什么不做全仓禁令：
 *  - 页面级全局配置表单（无 record 概念）、登录/找回密码等认证流程、
 *    工作流设计器与运行时表单、db-admin 行编辑器等，确实需要自持 FormApi；
 *  - `useEditModal` 内部本身也持有一个 FormApi ref（不在扫描范围内，只扫 pages/）。
 *
 * 因此采用与 check-invalidation-baseline.mjs 相同的「基线清单 + 只减不增」：
 * 已知的历史位置记录在 edit-modal-baseline.json，新增会失败，
 * 已迁移的页面回退也会失败（基线里没有它，等于新增）。
 * 基线条目数即迁移进度条——迁完一个删一个。
 *
 * 用法：
 *   node scripts/check-edit-modal-baseline.mjs          # 校验
 *   node scripts/check-edit-modal-baseline.mjs --update # 重新生成基线（迁移完一批后执行）
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = join(ROOT, 'src', 'pages');
const BASELINE_PATH = join(ROOT, 'scripts', 'edit-modal-baseline.json');

/** 自持表单实例：覆盖 `useRef<FormApi>`、`useRef<FormApi | null>`、`useRef<FormApi<T> | null>` */
const FORM_API_REF = /useRef<\s*FormApi(<[^>]*>)?(\s*\|\s*null)?\s*>/g;
/** 校验失败中断提交 */
const VALIDATION_THROW = /throw new Error\('validation'\)/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

function collect() {
  const result = {};
  for (const file of walk(PAGES_DIR)) {
    const text = readFileSync(file, 'utf8');
    const refs = (text.match(FORM_API_REF) ?? []).length;
    const throws = (text.match(VALIDATION_THROW) ?? []).length;
    const total = refs + throws;
    if (total > 0) {
      result[relative(PAGES_DIR, file).replace(/\\/g, '/')] = total;
    }
  }
  return result;
}

const current = collect();
const total = Object.values(current).reduce((s, n) => s + n, 0);

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`已更新基线：${Object.keys(sorted).length} 个文件，共 ${total} 处手写样板`);
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
        ? `${file}：新增 ${count} 处手写编辑弹窗样板（该页面已迁移或从未有过，不得回退）`
        : `${file}：手写样板由 ${allowed} 处增至 ${count} 处`,
    );
  }
}

if (problems.length > 0) {
  console.error('\n✖ 编辑弹窗样板回退：\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    [
      '',
      '新增/编辑弹窗请使用 @/hooks/useEditModal，不要手写 useRef<FormApi> 与',
      "throw new Error('validation')。该 hook 焊死了四条漏写不报错的契约：",
      '校验失败必须抛出、提示文案区分新增/编辑、保存后关闭并清空 editing、',
      '以及详情到达时按 key 重挂载表单。',
      '',
      '参考 pages/system/tenant-packages/TenantPackagesPage.tsx（简单场景）与',
      'pages/system/tenants/TenantsPage.tsx（含 beforeSave + onSaved）。',
      '规范见 .agents/skills/zenith/references/constraints.md 前端层「编辑弹窗状态」。',
      '',
      '确有正当理由自持表单实例（页面级全局配置表单、认证流程、设计器/运行时表单）',
      '请执行 node scripts/check-edit-modal-baseline.mjs --update 更新基线。',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const baselineTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
console.log(`✔ 页面层手写编辑弹窗样板 ${total} 处（基线 ${baselineTotal}），未出现回退`);
