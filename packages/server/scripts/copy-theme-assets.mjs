// 构建后置步骤：把主题样式表（src/cms/themes/**/*.css）拷贝进 dist 对应位置。
// tsc 只编译 TS，主题 CSS 是运行时经 theme-css.ts 从磁盘装配的兄弟资产。
import { cpSync, globSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve('src/cms/themes');
const DIST_ROOT = path.resolve('dist/cms/themes');

const files = globSync('**/*.css', { cwd: SRC_ROOT });
if (files.length === 0) {
  console.warn('[copy-theme-assets] 未发现主题 CSS，跳过');
  process.exit(0);
}
for (const rel of files) {
  const from = path.join(SRC_ROOT, rel);
  const to = path.join(DIST_ROOT, rel);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to);
}
console.log(`[copy-theme-assets] 已拷贝 ${files.length} 个主题样式表到 dist`);
