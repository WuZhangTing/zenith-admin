#!/usr/bin/env node
/**
 * Mastra Studio 静态资源生产化:从依赖树中的 mastra 包(根 devDependencies 管理版本)
 * 拷贝 dist/studio,并替换 index.html 中的 %%VAR%% 运行时占位符。
 *
 * 用法:node docker/build-studio.mjs <out-dir>
 * (Docker 构建与手动部署共用;npm script: `npm run build:studio`)
 *
 * 生产配置要点:
 * - MASTRA_AUTO_DETECT_URL=true:Studio 以 window.location.origin 为服务端地址,
 *   同源部署(Nginx /studio 静态托管 + /api/mastra 反代)无需在构建期写死域名,也没有 CORS。
 * - MASTRA_STUDIO_BASE_PATH=/studio:子路径托管(决定 <base href> 与静态资源路由)。
 * - 鉴权由服务端强制(authMiddleware + ai:studio:access),使用者登录管理后台后
 *   在 Studio Settings → Custom headers 配置 Authorization: Bearer <token>。
 */
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const [outArg] = process.argv.slice(2);
if (!outArg) {
  console.error('usage: node docker/build-studio.mjs <out-dir>');
  process.exit(1);
}

const require = createRequire(import.meta.url);
// 版本由根 package.json devDependencies + lockfile 管理,此处只做定位
const mastraPkgPath = require.resolve('mastra/package.json');
const studioSrc = join(dirname(mastraPkgPath), 'dist', 'studio');
const outDir = resolve(outArg);

/** 占位符 → 生产值;未列出的占位符一律替换为空串(与官方 .env 模板的空值语义一致) */
const values = {
  MASTRA_AUTO_DETECT_URL: 'true',
  MASTRA_API_PREFIX: '/api/mastra',
  MASTRA_STUDIO_BASE_PATH: '/studio',
  MASTRA_TELEMETRY_DISABLED: 'true',
  MASTRA_HIDE_CLOUD_CTA: 'true',
  MASTRA_TEMPLATES: 'false',
  MASTRA_EXPERIMENTAL_FEATURES: 'false',
  MASTRA_EXPERIMENTAL_UI: 'false',
};

cpSync(studioSrc, outDir, { recursive: true });
const indexPath = join(outDir, 'index.html');
const html = readFileSync(indexPath, 'utf8');
const replaced = html.replaceAll(/%%(\w+)%%/g, (_, key) => values[key] ?? '');
writeFileSync(indexPath, replaced);

const version = JSON.parse(readFileSync(mastraPkgPath, 'utf8')).version;
console.log(`[build-studio] mastra@${version} → ${outDir} (base /studio, auto-detect origin)`);
