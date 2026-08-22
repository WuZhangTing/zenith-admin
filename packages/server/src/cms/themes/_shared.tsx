/**
 * 主题公共件：全部主题共用的 SEO head、暗色主题脚本、埋点 beacon、分页与面包屑。
 *
 * 这些片段与主题视觉无关（分页 / 面包屑只输出语义结构，样式由各主题 styles.css 决定）。
 * 主题样式表装配（base.css + 主题 css + 站点覆盖）见 theme-css.ts，
 * SeoHead 统一消费渲染管线注入的 ctx.assets（正式外链 / 预览内联）。
 */
import type { ReactNode } from 'react';
import type { CmsBaseContext, CmsBreadcrumb, CmsModelFieldValue, CmsPagination } from './types';

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
  /** 是否输出 hreflang 备用语言链接（仅多语言站点主题需要） */
  langAlternates?: boolean;
  /** 主题追加的 head 节点（额外 preload / 第三方脚本等） */
  children?: ReactNode;
}

/**
 * 完整 `<head>`：TDK + Open Graph + Twitter Card + JSON-LD + 站点图标 + 主题样式与暗色脚本。
 *
 * 三级 TDK 覆盖与各 SEO 字段的取值已在渲染上下文（`ctx.seo`）算好；
 * 主题样式经 `ctx.assets` 输出——正式渲染外链指纹 CSS，预览渲染内联。
 */
export function SeoHead({ ctx, langAlternates = false, children }: SeoHeadProps) {
  const { site, seo, assets } = ctx;
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
      {assets.cssHref
        ? <link rel="stylesheet" href={assets.cssHref} />
        : <style dangerouslySetInnerHTML={{ __html: assets.inlineCss ?? '' }} />}
      {assets.darkMode !== 'light' ? (
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

/**
 * 模型字段表：按 group 分组渲染 `ctx.content.modelFields` 为键值表格
 * （政府站「文件信息表头」：文号 / 发布机关 / 成文日期 / 有效性等）。
 * 无勾选字段时不渲染；样式钩子 .model-fields / .model-fields-group / .model-fields-table。
 */
export function ModelFieldTable({ fields }: { fields: CmsModelFieldValue[] }) {
  const visible = fields.filter((f) => f.displayValue !== '');
  if (visible.length === 0) return null;
  const groups = new Map<string, CmsModelFieldValue[]>();
  for (const field of visible) {
    const key = field.group ?? '';
    groups.set(key, [...(groups.get(key) ?? []), field]);
  }
  return (
    <div className="model-fields">
      {[...groups.entries()].map(([group, list]) => (
        <div className="model-fields-group" key={group || '__default'}>
          {group ? <div className="model-fields-title">{group}</div> : null}
          <table className="model-fields-table">
            <tbody>
              {chunkPairs(list).map((pair) => (
                <tr key={pair[0].name}>
                  <th>{pair[0].label}</th>
                  <td>{pair[0].displayValue}</td>
                  {pair[1] ? <th>{pair[1].label}</th> : <th />}
                  {pair[1] ? <td>{pair[1].displayValue}</td> : <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/** 两列布局配对（政府公文信息表惯用双栏键值排布） */
function chunkPairs(list: CmsModelFieldValue[]): [CmsModelFieldValue, CmsModelFieldValue | undefined][] {
  const out: [CmsModelFieldValue, CmsModelFieldValue | undefined][] = [];
  for (let i = 0; i < list.length; i += 2) out.push([list[i], list[i + 1]]);
  return out;
}


/**
 * 内容形态区块：图集九宫格 / 音视频播放器（article/link 返回 null）。
 * 详情模板须在正文前调用，否则 album/media 形态只剩正文，主图数据丢失。
 * 样式钩子 .album-grid / .media-player（默认样式见 _shared/base.css）。
 */
export function MediaBlock({ content }: {
  content: {
    contentType: 'article' | 'album' | 'media' | 'link';
    title: string;
    albumImages: { url: string; thumb: string | null; caption: string | null }[];
    mediaType: 'video' | 'audio' | null;
    mediaUrl: string | null;
    mediaPoster: string | null;
    mediaDuration: string | null;
  };
}) {
  if (content.contentType === 'album' && content.albumImages.length > 0) {
    return (
      <div className="album-grid">
        {content.albumImages.map((img, i) => (
          <figure key={`${img.url}-${i}`}>
            <a href={img.url} target="_blank" rel="noopener">
              <img src={img.thumb ?? img.url} alt={img.caption ?? `${content.title} ${i + 1}`} loading="lazy" />
            </a>
            {img.caption ? <figcaption>{img.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    );
  }
  if (content.contentType === 'media' && content.mediaUrl) {
    return (
      <div className="media-player">
        {content.mediaType === 'audio'
          ? <audio src={content.mediaUrl} controls preload="metadata" />
          : <video src={content.mediaUrl} controls preload="metadata" poster={content.mediaPoster ?? undefined} />}
        {content.mediaDuration ? <div className="media-duration">时长：{content.mediaDuration}</div> : null}
      </div>
    );
  }
  return null;
}

