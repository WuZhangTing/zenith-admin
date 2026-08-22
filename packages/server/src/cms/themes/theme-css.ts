/**
 * 主题样式表装配：最终 CSS = _shared/base.css + themes/{code}/styles.css + 站点级覆盖
 * （主题色 themePrimary + 暗色模式规则）。
 *
 * - 开发模式每次渲染直读文件（改 css 刷新即生效，不触发进程重启）；生产模式进程内缓存。
 * - hash 基于最终 CSS 内容，供静态资产指纹（theme.{hash}.css）与 immutable 缓存使用。
 * - 主题源码不再内联样式字符串；样式文件与组件同目录，构建时由 copy-theme-assets 拷入 dist。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CmsTheme } from './types';

const THEMES_DIR = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';

const fileCache = new Map<string, string>();

function readCssFile(absPath: string): string {
  if (!IS_PROD) {
    try {
      return readFileSync(absPath, 'utf8');
    } catch {
      return '';
    }
  }
  let hit = fileCache.get(absPath);
  if (hit === undefined) {
    try {
      hit = readFileSync(absPath, 'utf8');
    } catch {
      hit = '';
    }
    fileCache.set(absPath, hit);
  }
  return hit;
}

/** base.css + 主题 styles.css（不含站点级覆盖） */
export function loadThemeStylesheet(themeCode: string): string {
  const base = readCssFile(path.join(THEMES_DIR, '_shared', 'base.css'));
  const theme = readCssFile(path.join(THEMES_DIR, themeCode, 'styles.css'));
  return `${base}\n${theme}`;
}

/** 站点级覆盖：settings.themePrimary 主题色 + settings.themeDark 暗色模式（暗色变量组由主题声明） */
export function buildThemeOverrides(
  settings: Record<string, unknown>,
  darkVars: string,
): { css: string; darkMode: 'auto' | 'light' | 'dark' } {
  const primary = typeof settings.themePrimary === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(settings.themePrimary)
    ? settings.themePrimary
    : null;
  const darkMode = settings.themeDark === 'dark' || settings.themeDark === 'auto' ? settings.themeDark : 'light';
  let css = '';
  if (primary) css += `:root { --primary: ${primary}; }\n`;
  if (darkMode !== 'light' && darkVars) {
    css += `html[data-theme="dark"] { ${darkVars} }\n`;
    if (darkMode === 'auto') {
      css += `@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) { ${darkVars} } }\n`;
    }
  }
  return { css, darkMode };
}

export interface SiteThemeCss {
  /** 完整可用样式表（base + 主题 + 站点覆盖） */
  css: string;
  darkMode: 'auto' | 'light' | 'dark';
  /** 内容指纹（静态资产文件名 theme.{hash}.css） */
  hash: string;
}

/** 装配站点最终样式表并计算内容指纹 */
export function buildSiteThemeCss(theme: CmsTheme, settings: Record<string, unknown> | null | undefined): SiteThemeCss {
  const sheet = loadThemeStylesheet(theme.code);
  const overrides = buildThemeOverrides(settings ?? {}, theme.darkVars ?? '');
  const css = overrides.css ? `${sheet}\n${overrides.css}` : sheet;
  return {
    css,
    darkMode: overrides.darkMode,
    hash: createHash('sha1').update(css).digest('hex').slice(0, 10),
  };
}
