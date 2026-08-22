/**
 * news-portal 新闻门户主题：报纸风格 —— 居中大报头 + 主色主导航横条 +
 * 首页头条区（大标题 + 摘要 + 子链）+ 多栏新闻区块 + 热点排行侧栏 + 新闻详情（来源/记者/责编脚注）。
 *
 * 变体模板（栏目/内容级按需选用）：
 * - list-headline：纯标题两栏列表（时政要闻/通知类栏目）
 * - list-photo：图片网格（图片新闻/视觉栏目）
 * - detail-plain：简洁正文（公告/启事，弱化新闻元信息）
 * - detail-wide：宽幅版式（视频/图集等大屏内容）
 *
 * 适用：地方日报融媒体、行业资讯门户等以"时效新闻流"为主的站点。
 */
import type { ReactNode } from 'react';
import type {
  CmsBaseContext, CmsContentItem, CmsListContext, CmsDetailContext,
  CmsPageContext, CmsSearchContext, CmsTagPageContext, CmsNotFoundContext,
  CmsTheme, CmsThemeContentCollection,
} from '../types';
import { SeoHead, Breadcrumbs, Pagination, ModelFieldTable, MODEL_FIELD_TABLE_STYLES, MediaBlock, MEDIA_BLOCK_STYLES, buildAnalyticsBeacon, buildThemeOverrides } from '../_shared';
import { defineHomeTemplate } from '../sdk';
import { renderCmsWidgetHtml } from '../widgets';
import { CMS_WIDGET_RENDERER_KEYS } from '@zenith/shared/cms';

const styles = `
:root { --primary: #c62828; --text: #24292f; --text-2: #6a737d; --border: #e2e6ea; --bg: #ffffff; --bg-2: #f5f7fa; --bg-3: #edf0f4; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif; color: var(--text); background: var(--bg); line-height: 1.75; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; transition: color .15s ease; }
a:hover { color: var(--primary); }
img { max-width: 100%; }
::selection { background: color-mix(in srgb, var(--primary) 22%, transparent); }
.w1200 { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

/* ── 报头：居中大字 + 口号 ───────────────────────────────────── */
.paper-head { padding: 26px 0 20px; text-align: center; background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 5%, #fff), #fff); }
.paper-brand { display: inline-flex; align-items: center; gap: 14px; }
.paper-brand img { height: 54px; }
.paper-title { font-size: 40px; font-weight: 900; letter-spacing: 8px; color: var(--primary); font-family: 'STZhongsong', 'SimSun', serif; }
.paper-slogan { margin-top: 8px; font-size: 13px; color: var(--text-2); letter-spacing: 4px; }
.paper-slogan::before, .paper-slogan::after { content: '——'; margin: 0 10px; opacity: .4; }

/* ── 主导航：固定高度，高亮与导航条严格重叠 ─────────────────── */
.news-nav { background: var(--primary); position: sticky; top: 0; z-index: 50; box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent); }
.news-nav .w1200 { display: flex; align-items: stretch; }
.news-nav a.nv { color: #fff; font-size: 16px; height: 50px; line-height: 50px; padding: 0 22px; white-space: nowrap; display: block; flex-shrink: 0; transition: background .15s ease; }
.news-nav a.nv:hover, .news-nav a.nv.active { background: rgba(0, 0, 0, .16); color: #fff; }
.news-nav .nav-search { margin-left: auto; display: flex; align-items: center; flex-shrink: 0; }
.news-nav .nav-search input { border: none; border-radius: 3px 0 0 3px; padding: 7px 12px; font-size: 13px; width: 180px; outline: none; }
.news-nav .nav-search button { background: rgba(0, 0, 0, .28); color: #fff; border: none; border-radius: 0 3px 3px 0; padding: 7px 14px; font-size: 13px; cursor: pointer; }

main { min-height: 60vh; padding: 24px 0 52px; }

/* ── 首页头条区 ─────────────────────────────────────────────── */
.headline { text-align: center; padding: 12px 0 22px; border-bottom: 3px double var(--border); margin-bottom: 24px; }
.headline h2 { font-size: 32px; font-weight: 800; line-height: 1.45; }
.headline h2 a:hover { color: var(--primary); }
.headline p { margin-top: 10px; color: var(--text-2); font-size: 15px; max-width: 880px; margin-left: auto; margin-right: auto; }
.headline .sub-links { margin-top: 12px; display: flex; justify-content: center; gap: 10px 24px; flex-wrap: wrap; font-size: 15px; }
.headline .sub-links a { color: var(--primary); }
.headline .sub-links a::before { content: '·'; margin-right: 6px; font-weight: 700; }

/* ── 区块标题 ───────────────────────────────────────────────── */
.news-box { margin-bottom: 6px; }
.news-box-hd { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 2px solid var(--bg-3); position: relative; margin-bottom: 8px; }
.news-box-hd::after { content: ''; position: absolute; left: 0; bottom: -2px; width: 86px; height: 2px; background: var(--primary); }
.news-box-hd h2 { font-size: 19px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.news-box-hd h2::before { content: ''; width: 5px; height: 18px; border-radius: 2px; background: var(--primary); }
.news-box-hd .more { font-size: 12px; color: var(--text-2); }
.news-box-hd .more:hover { color: var(--primary); }

/* ── 标题流列表（首页区块 / list-headline 变体共用）──────────── */
.news-list { list-style: none; }
.news-list li { padding: 9px 0; border-bottom: 1px dashed var(--border); font-size: 15px; display: flex; justify-content: space-between; gap: 12px; }
.news-list li:last-child { border-bottom: none; }
.news-list li a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.news-list li a::before { content: '·'; color: var(--primary); font-weight: 700; margin-right: 8px; }
.news-list li time { color: var(--text-2); font-size: 12.5px; flex-shrink: 0; }
.news-list li.lead { display: block; padding: 10px 0 12px; }
.news-list li.lead a { white-space: normal; font-weight: 700; font-size: 17px; line-height: 1.55; }
.news-list li.lead a::before { content: none; }
.news-list li.lead .abs { color: var(--text-2); font-size: 13px; margin-top: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.top-badge { display: inline-block; font-size: 11px; color: #fff; background: var(--primary); border-radius: 3px; padding: 1px 6px; margin-right: 7px; vertical-align: 1.5px; }

/* ── 首页布局 / 侧栏 ───────────────────────────────────────── */
.news-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 28px; align-items: start; }
.col-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-top: 22px; }
.rank-box { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0 16px 8px; margin-bottom: 20px; }
.rank-box h2 { font-size: 16px; font-weight: 700; margin: 0 -16px 6px; padding: 11px 16px 9px; border-bottom: 1px solid var(--border); background: var(--bg-2); border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 9px; }
.rank-box h2::before { content: ''; width: 4px; height: 15px; border-radius: 2px; background: var(--primary); }
.rank-list { list-style: none; counter-reset: rank; }
.rank-list li { counter-increment: rank; display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--border); font-size: 14px; align-items: baseline; }
.rank-list li:last-child { border-bottom: none; }
.rank-list li::before { content: counter(rank); font-size: 12px; font-weight: 700; color: var(--text-2); min-width: 20px; height: 20px; line-height: 20px; text-align: center; background: var(--bg-3); border-radius: 3px; flex-shrink: 0; }
.rank-list li:nth-child(-n+3)::before { background: var(--primary); color: #fff; }
.rank-list li a { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* ── 默认列表（图文混排）───────────────────────────────────── */
.content-list { display: flex; flex-direction: column; }
.content-item { display: flex; gap: 16px; padding: 15px 10px; border-bottom: 1px solid var(--bg-3); border-radius: 6px; transition: background .15s ease; }
.content-item:hover { background: var(--bg-2); }
.content-item:hover h3 a { color: var(--primary); }
.content-item .thumb { width: 172px; height: 108px; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: var(--bg-3); }
.content-item .ci-body { min-width: 0; flex: 1; }
.content-item h3 { font-size: 16.5px; font-weight: 600; line-height: 1.55; }
.content-item .abs { color: var(--text-2); font-size: 13.5px; margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.75; }
.content-item .meta { color: var(--text-2); font-size: 12px; margin-top: 8px; display: flex; gap: 14px; }

/* ── list-headline 变体：纯标题两栏 ─────────────────────────── */
.headline-cols { column-count: 2; column-gap: 40px; }
.headline-cols .news-list li { break-inside: avoid; }

/* ── list-photo 变体：图片网格 ──────────────────────────────── */
.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.photo-card { display: block; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: var(--bg); transition: box-shadow .18s ease; position: relative; }
.photo-card:hover { box-shadow: 0 8px 22px -8px rgba(20, 30, 44, .18); }
.photo-card .ph { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; background: var(--bg-3); transition: transform .3s ease; }
.photo-card:hover .ph { transform: scale(1.03); }
.photo-card .cap { padding: 10px 13px 12px; }
.photo-card h3 { font-size: 15px; font-weight: 600; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.photo-card time { display: block; font-size: 12px; color: var(--text-2); margin-top: 5px; }
.photo-card .count-badge { position: absolute; top: 10px; right: 10px; font-size: 11px; color: #fff; background: rgba(0,0,0,.55); border-radius: 3px; padding: 2px 8px; backdrop-filter: blur(3px); }

/* ── 面包屑 / 标题 / 页码 ───────────────────────────────────── */
.breadcrumbs { font-size: 13px; color: var(--text-2); margin-bottom: 16px; }
.breadcrumbs a { color: var(--text-2); }
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 16px; padding-left: 12px; border-left: 5px solid var(--primary); line-height: 1.4; }
.pagination { display: flex; gap: 8px; justify-content: center; margin-top: 30px; flex-wrap: wrap; }
.pagination a, .pagination span { min-width: 34px; text-align: center; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; transition: all .15s ease; }
.pagination a:hover { border-color: var(--primary); color: var(--primary); }
.pagination .current { background: var(--primary); border-color: var(--primary); color: #fff; }

/* ── 详情页（默认新闻版式）─────────────────────────────────── */
.article { max-width: 860px; margin: 0 auto; }
.article.wide { max-width: 1080px; }
.article h1 { font-size: 30px; font-weight: 800; line-height: 1.5; text-align: center; margin: 8px 0 14px; }
.article .meta { display: flex; justify-content: center; gap: 18px; color: var(--text-2); font-size: 13px; padding: 10px 0; border-top: 1px solid var(--bg-3); border-bottom: 1px solid var(--bg-3); margin-bottom: 22px; flex-wrap: wrap; }
.article .body { font-size: 17px; line-height: 2; }
.article .body p { margin: 0 0 1em; }
.article .body h2 { font-size: 20px; font-weight: 700; margin: 1.4em 0 .7em; padding-left: 12px; border-left: 4px solid var(--primary); }
.article .body img { display: block; margin: 16px auto; border-radius: 6px; box-shadow: 0 2px 10px rgba(20,30,44,.08); }
.article .body blockquote { margin: 16px 0; padding: 12px 18px; border-left: 4px solid color-mix(in srgb, var(--primary) 45%, var(--border)); background: var(--bg-2); color: var(--text-2); }
.article .body ul, .article .body ol { padding-left: 1.6em; margin: 0 0 1em; }
.article .footnote { margin-top: 26px; padding-top: 12px; border-top: 1px solid var(--bg-3); color: var(--text-2); font-size: 13px; text-align: right; }
.article .tags { margin-top: 24px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.article .tags a { font-size: 12.5px; background: var(--bg-2); border: 1px solid var(--border); border-radius: 3px; padding: 3px 12px; color: var(--text-2); transition: all .15s ease; }
.article .tags a:hover { border-color: var(--primary); color: var(--primary); }
/* detail-plain 变体：弱化元信息的公告版式 */
.article.plain h1 { font-size: 26px; font-weight: 700; }
.article.plain .meta { border: none; padding: 0 0 6px; }
.article.plain .body { font-size: 16px; }

.attachments { list-style: none; margin-top: 20px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.attachments li { padding: 9px 14px; font-size: 14px; border-bottom: 1px solid var(--bg-3); }
.attachments li:last-child { border-bottom: none; }
.attachments .ext { display: inline-block; font-size: 11px; font-weight: 700; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); border-radius: 3px; padding: 1px 7px; margin-right: 8px; }
.article-nav { max-width: 860px; margin: 24px auto 0; padding: 13px 18px; border-radius: 6px; background: var(--bg-2); display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: var(--text-2); }
.related-articles { max-width: 860px; margin: 26px auto 0; }
.related-articles h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; padding-left: 10px; border-left: 4px solid var(--primary); }
.related-articles ul { list-style: none; }
.related-articles li { padding: 5px 0; font-size: 14px; }
.related-articles li::before { content: '·'; color: var(--primary); font-weight: 700; margin-right: 8px; }

.empty { text-align: center; color: var(--text-2); padding: 52px 0; }
.search-result mark { background: #fff3bf; color: inherit; padding: 0 1px; }

/* ── 页脚 ───────────────────────────────────────────────────── */
footer.news-footer { margin-top: 42px; border-top: 3px solid var(--primary); background: var(--bg-2); padding: 26px 0 24px; font-size: 13px; color: var(--text-2); text-align: center; line-height: 2.1; }
footer.news-footer .links { display: flex; gap: 6px 18px; flex-wrap: wrap; justify-content: center; margin-bottom: 8px; }
footer.news-footer .links a:hover { color: var(--primary); }
footer.news-footer .extra { white-space: pre-line; }
${MODEL_FIELD_TABLE_STYLES}
${MEDIA_BLOCK_STYLES}
@media (max-width: 900px) {
  .paper-title { font-size: 28px; letter-spacing: 4px; }
  .news-nav .w1200 { overflow-x: auto; scrollbar-width: none; }
  .news-nav .nav-search { display: none; }
  .news-grid, .col-blocks { grid-template-columns: 1fr; }
  .headline h2 { font-size: 23px; }
  .headline-cols { column-count: 1; }
  .photo-grid { grid-template-columns: repeat(2, 1fr); }
  .content-item .thumb { width: 120px; height: 76px; }
  .article h1 { font-size: 23px; }
}
@media (max-width: 560px) { .photo-grid { grid-template-columns: 1fr; } }
@media print {
  .news-nav, footer.news-footer, .article-nav, .related-articles, .breadcrumbs { display: none !important; }
  body { background: #fff; }
}
`;

function NewsLayout({ ctx, currentUrl, children }: { ctx: CmsBaseContext; currentUrl?: string; children: ReactNode }) {
  const { site, nav, friendLinks, baseUrl } = ctx;
  const theme = buildThemeOverrides(site.settings, '');
  const slogan = typeof site.themeConfig.slogan === 'string' ? site.themeConfig.slogan : '';
  const footerText = typeof site.themeConfig.footerText === 'string' ? site.themeConfig.footerText : null;
  return (
    <html lang="zh-CN">
      <SeoHead ctx={ctx} css={styles + theme.css} darkMode="light" />
      <body>
        {ctx.analytics ? <script dangerouslySetInnerHTML={{ __html: buildAnalyticsBeacon(ctx.analytics) }} /> : null}
        <header className="paper-head">
          <a className="paper-brand" href={`${baseUrl}/`}>
            {site.logo ? <img src={site.logo} alt={site.name} /> : null}
            <span className="paper-title">{site.name}</span>
          </a>
          {slogan ? <div className="paper-slogan">{slogan}</div> : null}
        </header>
        <nav className="news-nav">
          <div className="w1200">
            <a className={`nv${currentUrl === `${baseUrl}/` ? ' active' : ''}`} href={`${baseUrl}/`}>首页</a>
            {nav.map((item) => (
              <a key={item.id} className={`nv${currentUrl === item.url ? ' active' : ''}`} href={item.url} target={item.target}>{item.name}</a>
            ))}
            <form className="nav-search" action={ctx.searchUrl} method="get">
              <input type="search" name="q" placeholder="搜索新闻" />
              <button type="submit">搜索</button>
            </form>
          </div>
        </nav>
        <main className="w1200">{children}</main>
        <footer className="news-footer">
          <div className="w1200">
            {friendLinks.length > 0 ? (
              <div className="links">
                {friendLinks.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener nofollow">{l.name}</a>)}
              </div>
            ) : null}
            {footerText ? <div className="extra">{footerText}</div> : null}
            {site.copyright ? <div>{site.copyright}</div> : null}
            {site.icp ? <div><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener nofollow">{site.icp}</a></div> : null}
          </div>
        </footer>
      </body>
    </html>
  );
}

function externalProps(item: CmsContentItem) {
  return item.isExternal ? { target: '_blank', rel: 'noopener nofollow' } : {};
}

/** 标题流列表：lead 指定前 N 条渲染为加粗标题+摘要 */
function NewsList({ items, lead = 0, showTop = false }: { items: CmsContentItem[]; lead?: number; showTop?: boolean }) {
  if (items.length === 0) return <div className="empty">暂无内容</div>;
  return (
    <ul className="news-list">
      {items.map((item, idx) => (
        <li key={item.id} className={idx < lead ? 'lead' : undefined}>
          {idx < lead ? (
            <span>
              <a href={item.url} {...externalProps(item)}>
                {showTop && item.isTop ? <span className="top-badge">置顶</span> : null}
                {item.title}
              </a>
              {item.summary ? <span className="abs">{item.summary}</span> : null}
            </span>
          ) : (
            <a href={item.url} {...externalProps(item)}>
              {showTop && item.isTop ? <span className="top-badge">置顶</span> : null}
              {item.title}
            </a>
          )}
          {idx >= lead && item.publishedAt ? <time>{item.publishedAt.slice(5, 10)}</time> : null}
        </li>
      ))}
    </ul>
  );
}

function NewsBox({ title, moreUrl, children }: { title: string; moreUrl?: string | null; children: ReactNode }) {
  return (
    <section className="news-box">
      <div className="news-box-hd">
        <h2>{title}</h2>
        {moreUrl ? <a className="more" href={moreUrl}>更多 »</a> : null}
      </div>
      {children}
    </section>
  );
}

// ─── 首页（Theme API：load 声明式取数）────────────────────────────────────────

type HomeBlock = CmsThemeContentCollection & { channel: NonNullable<CmsThemeContentCollection['channel']> };

const HomeTemplate = defineHomeTemplate({
  load: async ({ cms, site }) => {
    const raw = typeof site.themeConfig.homeChannels === 'string' ? site.themeConfig.homeChannels : '';
    const codes = raw.split(/[,，]/).map((code) => code.trim()).filter(Boolean).slice(0, 6);
    const blocks = await Promise.all(codes.map((code) => cms.contents.list({ channelCode: code, limit: 8 })));
    return { blocks: blocks.filter((block): block is HomeBlock => block.channel !== null) };
  },
  Component: ({ data, ...ctx }) => {
    const [primary, ...rest] = data.blocks;
    const primaryItems = primary?.list ?? ctx.latest;
    const headline = primaryItems[0] ?? null;
    const headlineSubs = primaryItems.slice(1, 4);
    const primaryRest = primaryItems.slice(4);
    const hotItems = ctx.hot.length > 0 ? ctx.hot : ctx.latest;
    return (
      <NewsLayout ctx={ctx} currentUrl={`${ctx.baseUrl}/`}>
        {headline ? (
          <div className="headline">
            <h2><a href={headline.url} {...externalProps(headline)}>{headline.title}</a></h2>
            {headline.summary ? <p>{headline.summary}</p> : null}
            {headlineSubs.length > 0 ? (
              <div className="sub-links">
                {headlineSubs.map((item) => <a key={item.id} href={item.url} {...externalProps(item)}>{item.title}</a>)}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="news-grid">
          <div>
            {primary && primaryRest.length > 0 ? (
              <NewsBox title={primary.channel.name} moreUrl={primary.channel.url}>
                <NewsList items={primaryRest} lead={1} showTop />
              </NewsBox>
            ) : null}
            <div className="col-blocks">
              {rest.map((block) => (
                <NewsBox key={block.channel.code} title={block.channel.name} moreUrl={block.channel.url}>
                  <NewsList items={block.list.slice(0, 6)} />
                </NewsBox>
              ))}
            </div>
          </div>
          <aside>
            <div className="rank-box">
              <h2>热点排行</h2>
              <ul className="rank-list">
                {hotItems.slice(0, 10).map((item) => (
                  <li key={item.id}><a href={item.url} {...externalProps(item)}>{item.title}</a></li>
                ))}
              </ul>
            </div>
            {ctx.homeSidebar ? <div dangerouslySetInnerHTML={{ __html: renderCmsWidgetHtml(ctx.homeSidebar) }} /> : null}
            {ctx.recommended.length > 0 ? (
              <div className="rank-box">
                <h2>编辑推荐</h2>
                <ul className="rank-list">
                  {ctx.recommended.slice(0, 8).map((item) => (
                    <li key={item.id}><a href={item.url} {...externalProps(item)}>{item.title}</a></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </NewsLayout>
    );
  },
});

// ─── 列表：默认图文混排 ───────────────────────────────────────────────────────

function ListTemplate(ctx: CmsListContext) {
  return (
    <NewsLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <h1 className="page-title">{ctx.channel.name}</h1>
      <div className="content-list">
        {ctx.items.length === 0 ? <div className="empty">暂无内容</div> : ctx.items.map((item) => (
          <div className="content-item" key={item.id}>
            {(item.coverThumb || item.coverImage) ? <img className="thumb" src={item.coverThumb ?? item.coverImage ?? ''} alt="" loading="lazy" /> : null}
            <div className="ci-body">
              <h3>
                <a href={item.url} {...externalProps(item)}>
                  {item.isTop ? <span className="top-badge">置顶</span> : null}
                  {item.title}
                </a>
              </h3>
              {item.summary ? <div className="abs">{item.summary}</div> : null}
              <div className="meta">
                {item.source ? <span>{item.source}</span> : null}
                {item.publishedAt ? <time>{item.publishedAt.slice(0, 16)}</time> : null}
                <span>{item.viewCount} 阅读</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination p={ctx.pagination} />
    </NewsLayout>
  );
}

// ─── 列表变体：list-headline 纯标题两栏（时政要闻/通知）───────────────────────

function ListHeadlineTemplate(ctx: CmsListContext) {
  return (
    <NewsLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <h1 className="page-title">{ctx.channel.name}</h1>
      {ctx.items.length === 0 ? <div className="empty">暂无内容</div> : (
        <div className="headline-cols">
          <NewsList items={ctx.items} showTop />
        </div>
      )}
      <Pagination p={ctx.pagination} />
    </NewsLayout>
  );
}

// ─── 列表变体：list-photo 图片网格（图片新闻/视觉栏目）────────────────────────

function ListPhotoTemplate(ctx: CmsListContext) {
  return (
    <NewsLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <h1 className="page-title">{ctx.channel.name}</h1>
      {ctx.items.length === 0 ? <div className="empty">暂无内容</div> : (
        <div className="photo-grid">
          {ctx.items.map((item) => (
            <a className="photo-card" key={item.id} href={item.url} {...externalProps(item)}>
              {(item.coverThumb || item.coverImage)
                ? <img className="ph" src={item.coverThumb ?? item.coverImage ?? ''} alt={item.title} loading="lazy" />
                : <span className="ph" />}
              {item.contentType === 'album' && item.imageCount > 0 ? <span className="count-badge">{item.imageCount} 图</span> : null}
              {item.contentType === 'media' ? <span className="count-badge">▶ 视频</span> : null}
              <span className="cap">
                <h3>{item.title}</h3>
                {item.publishedAt ? <time>{item.publishedAt.slice(0, 10)}</time> : null}
              </span>
            </a>
          ))}
        </div>
      )}
      <Pagination p={ctx.pagination} />
    </NewsLayout>
  );
}

// ─── 详情：默认新闻版式（来源/记者/责编脚注）──────────────────────────────────

function ArticleBody({ ctx, wide = false, plain = false }: { ctx: CmsDetailContext; wide?: boolean; plain?: boolean }) {
  const { content } = ctx;
  const cls = ['article', wide ? 'wide' : '', plain ? 'plain' : ''].filter(Boolean).join(' ');
  return (
    <>
      <article className={cls}>
        <h1>{content.title}</h1>
        <div className="meta">
          {content.publishedAt ? <time>{content.publishedAt}</time> : null}
          {content.source ? <span>来源：{content.source}</span> : null}
          {!plain && content.author ? <span>记者：{content.author}</span> : null}
          <span>阅读：{content.viewCount}</span>
        </div>
        {content.modelFields.length > 0 ? <ModelFieldTable fields={content.modelFields} /> : null}
        <MediaBlock content={content} />
        <div className="body" dangerouslySetInnerHTML={{ __html: content.body }} />
        {content.attachments.length > 0 ? (
          <ul className="attachments">
            {content.attachments.map((a) => (
              <li key={`${a.url}-${a.sort}`}>
                <a href={a.url} download target="_blank" rel="noopener">
                  {a.ext ? <span className="ext">{a.ext.toUpperCase()}</span> : null}
                  {a.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {content.tags.length > 0 ? (
          <div className="tags">
            {content.tags.map((t) => <a key={t.slug} href={t.url}>{t.name}</a>)}
          </div>
        ) : null}
        {!plain && content.author ? <div className="footnote">责任编辑：{content.author}</div> : null}
      </article>
      {(content.prev || content.next) ? (
        <nav className="article-nav">
          {content.prev ? <span>上一篇：<a href={content.prev.url}>{content.prev.title}</a></span> : null}
          {content.next ? <span>下一篇：<a href={content.next.url}>{content.next.title}</a></span> : null}
        </nav>
      ) : null}
      {ctx.related.length > 0 ? (
        <section className="related-articles">
          <h3>延伸阅读</h3>
          <ul>
            {ctx.related.map((r) => <li key={r.url}><a href={r.url}>{r.title}</a></li>)}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function DetailTemplate(ctx: CmsDetailContext) {
  return (
    <NewsLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <ArticleBody ctx={ctx} />
    </NewsLayout>
  );
}

/** detail-plain 变体：公告/启事简洁版式（弱化记者/责编等新闻元信息） */
function DetailPlainTemplate(ctx: CmsDetailContext) {
  return (
    <NewsLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <ArticleBody ctx={ctx} plain />
    </NewsLayout>
  );
}

/** detail-wide 变体：宽幅版式（视频/图集等大屏内容） */
function DetailWideTemplate(ctx: CmsDetailContext) {
  return (
    <NewsLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <ArticleBody ctx={ctx} wide />
    </NewsLayout>
  );
}

// ─── 单页 / 搜索 / 标签 / 404 ─────────────────────────────────────────────────

function PageTemplate(ctx: CmsPageContext) {
  return (
    <NewsLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <article className="article">
        <h1>{ctx.channel.name}</h1>
        <div className="body" dangerouslySetInnerHTML={{ __html: ctx.contentHtml }} />
      </article>
    </NewsLayout>
  );
}

function SearchTemplate(ctx: CmsSearchContext) {
  return (
    <NewsLayout ctx={ctx}>
      <h1 className="page-title">搜索「{ctx.keyword}」</h1>
      <div className="content-list search-result">
        {ctx.results.length === 0 ? (
          <div className="empty">未找到相关内容</div>
        ) : ctx.results.map((r) => (
          <div className="content-item" key={r.id}>
            <div className="ci-body">
              <h3>
                <a
                  href={r.isExternal ? r.url : `${ctx.baseUrl}${r.url}`}
                  {...(r.isExternal ? { target: '_blank', rel: 'noopener nofollow' } : {})}
                  dangerouslySetInnerHTML={{ __html: r.titleHighlight }}
                />
              </h3>
              <div className="meta">{r.publishedAt ? <time>{r.publishedAt.slice(0, 10)}</time> : null}</div>
            </div>
          </div>
        ))}
      </div>
      <Pagination p={ctx.pagination} />
    </NewsLayout>
  );
}

function TagTemplate(ctx: CmsTagPageContext) {
  return (
    <NewsLayout ctx={ctx}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <h1 className="page-title">标签：{ctx.tag.name}（{ctx.tag.contentCount}）</h1>
      <NewsList items={ctx.items} />
      <Pagination p={ctx.pagination} />
    </NewsLayout>
  );
}

function NotFoundTemplate(ctx: CmsNotFoundContext) {
  return (
    <NewsLayout ctx={ctx}>
      <div className="empty">
        <h1 className="page-title" style={{ display: 'inline-block' }}>404 页面不存在</h1>
        <p>您访问的页面不存在或已被移除：{ctx.path}</p>
        <p><a href={`${ctx.baseUrl}/`} style={{ color: 'var(--primary)' }}>返回首页</a></p>
      </div>
    </NewsLayout>
  );
}

export const newsPortalTheme: CmsTheme = {
  code: 'news-portal',
  label: '新闻门户',
  templates: {
    index: HomeTemplate,
    list: ListTemplate,
    detail: DetailTemplate,
    page: PageTemplate,
    search: SearchTemplate,
    tag: TagTemplate,
    notFound: NotFoundTemplate,
  },
  extraListTemplates: {
    'list-headline': { label: '纯标题两栏（要闻/通知）', component: ListHeadlineTemplate },
    'list-photo': { label: '图片网格（图片/视频新闻）', component: ListPhotoTemplate },
  },
  extraDetailTemplates: {
    'detail-plain': { label: '简洁正文（公告/启事）', component: DetailPlainTemplate },
    'detail-wide': { label: '宽幅版式（视频/图集）', component: DetailWideTemplate },
  },
  settingsSchema: [
    { name: 'slogan', label: '报头口号', fieldType: 'text', group: '页头', placeholder: '如 权威发布 · 深度报道', description: '报头下方的口号文字，留空不显示' },
    { name: 'homeChannels', label: '首页栏目区块', fieldType: 'text', group: '首页', placeholder: '如 bsyw,mszh,cjjj', description: '逗号分隔栏目标识（最多 6 个）：第 1 个为头条+主栏区块，其余按两列区块排布；留空回落全站最新发布' },
    { name: 'footerText', label: '页脚附加文案', fieldType: 'textarea', group: '页脚', placeholder: '报社地址、新闻热线等，支持多行' },
  ],
  widgetSlots: [{
    key: 'home.sidebar',
    label: '首页侧栏',
    allowedTypes: ['manual-list'],
    rendererKeys: [...CMS_WIDGET_RENDERER_KEYS],
  }],
};
