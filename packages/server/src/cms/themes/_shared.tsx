/**
 * 主题公共件：`default` 与 `docs` 两套主题（以及后续新增主题）共用的
 * SEO head、暗色主题脚本、埋点 beacon、分页与面包屑。
 *
 * 这些片段与主题视觉无关（分页 / 面包屑只输出语义结构，样式由各主题 CSS 决定），
 * 此前在两套主题里各存一份，SEO 字段一旦新增就只有一套主题吃到。
 */
import type { ReactNode } from 'react';
import type { CmsBaseContext, CmsBreadcrumb, CmsPagination } from './types';

/** 主题参数（站点 settings）：主色 / 暗色模式；`darkVars` 由各主题给出自己的暗色变量组 */
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
  if (darkMode !== 'light') {
    css += `html[data-theme="dark"] { ${darkVars} }\n`;
    if (darkMode === 'auto') {
      css += `@media (prefers-color-scheme: dark) { html:not([data-theme="light"]) { ${darkVars} } }\n`;
    }
  }
  return { css, darkMode };
}

/** 暗色初始化脚本（head 内先行执行防闪烁）+ 切换按钮事件委托 */
export const THEME_TOGGLE_SCRIPT = `(function(){try{
var t=localStorage.getItem('cms_theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}
document.addEventListener('click',function(e){
var b=e.target&&e.target.closest?e.target.closest('.theme-toggle'):null;if(!b)return;
var h=document.documentElement;var cur=h.getAttribute('data-theme');
var next=cur==='dark'?'light':(cur==='light'?'dark':(window.matchMedia('(prefers-color-scheme: dark)').matches?'light':'dark'));
h.setAttribute('data-theme',next);localStorage.setItem('cms_theme',next);});
}catch(e){}})();`;

/** 行为采集 beacon 脚本（page_view + 详情页浏览计数），仅站点开启统计时注入 */
export function buildAnalyticsBeacon(analytics: NonNullable<CmsBaseContext['analytics']>): string {
  return `(function(){try{
var K=${JSON.stringify(analytics.siteKey)};var C=${analytics.contentId ?? 'null'};
var ls=window.localStorage,ss=window.sessionStorage;
var aid=ls.getItem('cms_aid')||(Date.now().toString(36)+Math.random().toString(36).slice(2,10));ls.setItem('cms_aid',aid);
var sid=ss.getItem('cms_sid')||(Date.now().toString(36)+Math.random().toString(36).slice(2,10));ss.setItem('cms_sid',sid);
var ev={eventType:'page_view',sessionId:sid,anonymousId:aid,pagePath:location.pathname,pageTitle:document.title,referrer:document.referrer||undefined};
navigator.sendBeacon('/api/analytics/events?siteKey='+encodeURIComponent(K),new Blob([JSON.stringify({events:[ev]})],{type:'application/json'}));
if(C){navigator.sendBeacon('/api/public/cms/view',new Blob([JSON.stringify({contentId:C})],{type:'application/json'}));}
}catch(e){}})();`;
}

export interface SeoHeadProps {
  ctx: CmsBaseContext;
  /** 主题 CSS（基础样式 + buildThemeOverrides 产出的变量覆盖） */
  css: string;
  darkMode: 'auto' | 'light' | 'dark';
  /** 是否输出 hreflang 备用语言链接（仅多语言站点主题需要） */
  langAlternates?: boolean;
  /** 主题追加的 head 节点（额外 preload / 第三方脚本等） */
  children?: ReactNode;
}

/**
 * 完整 `<head>`：TDK + Open Graph + Twitter Card + JSON-LD + 站点图标 + 主题样式与暗色脚本。
 *
 * 三级 TDK 覆盖与各 SEO 字段的取值已在渲染上下文（`ctx.seo`）算好，这里只负责输出。
 */
export function SeoHead({ ctx, css, darkMode, langAlternates = false, children }: SeoHeadProps) {
  const { site, seo } = ctx;
  return (
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{seo.title}</title>
      {seo.keywords ? <meta name="keywords" content={seo.keywords} /> : null}
      {seo.description ? <meta name="description" content={seo.description} /> : null}
      {seo.canonical ? <link rel="canonical" href={seo.canonical} /> : null}
      {langAlternates
        ? ctx.langAlternates.map((alt) => (
          <link key={alt.language} rel="alternate" hrefLang={alt.language} href={alt.url} />
        ))
        : null}
      <meta property="og:type" content={seo.ogType} />
      <meta property="og:title" content={seo.ogTitle} />
      {seo.ogDescription ? <meta property="og:description" content={seo.ogDescription} /> : null}
      {seo.ogImage ? <meta property="og:image" content={seo.ogImage} /> : null}
      {seo.ogImageAlt ? <meta property="og:image:alt" content={seo.ogImageAlt} /> : null}
      {seo.ogUrl ? <meta property="og:url" content={seo.ogUrl} /> : null}
      <meta property="og:site_name" content={seo.ogSiteName} />
      {seo.articlePublishedTime ? <meta property="article:published_time" content={seo.articlePublishedTime} /> : null}
      {seo.articleModifiedTime ? <meta property="article:modified_time" content={seo.articleModifiedTime} /> : null}
      {seo.articleAuthor ? <meta property="article:author" content={seo.articleAuthor} /> : null}
      <meta name="twitter:card" content={seo.twitterCard} />
      {seo.twitterSite ? <meta name="twitter:site" content={seo.twitterSite} /> : null}
      {seo.twitterCreator ? <meta name="twitter:creator" content={seo.twitterCreator} /> : null}
      <meta name="twitter:title" content={seo.twitterTitle} />
      {seo.twitterDescription ? <meta name="twitter:description" content={seo.twitterDescription} /> : null}
      {seo.twitterImage ? <meta name="twitter:image" content={seo.twitterImage} /> : null}
      {seo.twitterImageAlt ? <meta name="twitter:image:alt" content={seo.twitterImageAlt} /> : null}
      {site.favicon ? <link rel="icon" href={site.favicon} /> : null}
      <meta name="generator" content="Zenith CMS" />
      {seo.jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }} />
      ) : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {darkMode !== 'light' ? (
        <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      ) : null}
      {children}
    </head>
  );
}

/** 分页条：单页时不渲染 */
export function Pagination({ p }: { p: CmsPagination }) {
  if (p.totalPages <= 1) return null;
  return (
    <div className="pagination">
      {p.prevUrl ? <a href={p.prevUrl}>上一页</a> : null}
      {p.pages.map((pg) => (
        pg.current
          ? <span key={pg.page} className="current">{pg.page}</span>
          : <a key={pg.page} href={pg.url}>{pg.page}</a>
      ))}
      {p.nextUrl ? <a href={p.nextUrl}>下一页</a> : null}
    </div>
  );
}

/** 面包屑：末级为当前页（纯文本），其余为链接 */
export function Breadcrumbs({ items }: { items: CmsBreadcrumb[] }) {
  return (
    <div className="breadcrumbs">
      {items.map((b, i) => (
        <span key={b.url}>
          {i > 0 ? ' / ' : ''}
          {i === items.length - 1 ? <span>{b.name}</span> : <a href={b.url}>{b.name}</a>}
        </span>
      ))}
    </div>
  );
}
