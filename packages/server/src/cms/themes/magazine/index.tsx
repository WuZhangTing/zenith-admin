/**
 * magazine 资讯杂志主题：暗色数字媒体形态——焦点大图首页 + 卡片流列表 +
 * 评分徽章详情（ratingField 主题参数指定评分字段），适合游戏/科技/数码/影视资讯站。
 *
 * 模型字段的两种消费方式在此示范：
 * - 列表卡片消费 item.modelFields（showInList 字段）渲染角标；
 * - 详情页把 ratingField 拆出来渲染为大评分徽章，其余字段行内标签展示。
 */
import type { ReactNode } from 'react';
import type {
  CmsBaseContext, CmsContentItem, CmsListContext, CmsDetailContext,
  CmsPageContext, CmsSearchContext, CmsTagPageContext, CmsNotFoundContext,
  CmsTheme, CmsThemeContentCollection, CmsModelFieldValue,
} from '../types';
import { SeoHead, Breadcrumbs, Pagination, MediaBlock, MEDIA_BLOCK_STYLES, buildAnalyticsBeacon, buildThemeOverrides } from '../_shared';
import { defineHomeTemplate } from '../sdk';
import { renderCmsWidgetHtml } from '../widgets';
import { CMS_WIDGET_RENDERER_KEYS } from '@zenith/shared/cms';

const styles = `
:root { --primary: #2dd4a7; --text: #e8eaf0; --text-2: #8b93a5; --border: #262b36; --bg: #0e1015; --bg-2: #171a21; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif; color: var(--text); background: var(--bg); line-height: 1.7; }
a { color: inherit; text-decoration: none; }
a:hover { color: var(--primary); }
img { max-width: 100%; }
.w1200 { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.topbar { position: sticky; top: 0; z-index: 50; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
.topbar .w1200 { display: flex; align-items: center; gap: 26px; height: 60px; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 21px; font-weight: 800; letter-spacing: 1px; flex-shrink: 0; }
.brand img { height: 32px; }
.brand .dot { color: var(--primary); }
.top-nav { display: flex; gap: 4px; overflow-x: auto; flex: 1; }
.top-nav a { padding: 6px 14px; border-radius: 6px; font-size: 15px; white-space: nowrap; color: var(--text-2); }
.top-nav a:hover { color: var(--text); background: var(--bg-2); }
.top-nav a.active { color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); }
.top-search { display: flex; flex-shrink: 0; }
.top-search input { background: var(--bg-2); border: 1px solid var(--border); border-right: none; border-radius: 6px 0 0 6px; padding: 7px 12px; font-size: 13px; width: 170px; color: var(--text); outline: none; }
.top-search button { background: var(--primary); color: #08110d; font-weight: 600; border: none; border-radius: 0 6px 6px 0; padding: 0 16px; font-size: 13px; cursor: pointer; }
main { min-height: 60vh; padding: 26px 0 50px; }
.breadcrumbs { font-size: 13px; color: var(--text-2); margin-bottom: 16px; }
.breadcrumbs a { color: var(--text-2); }
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 18px; }
.sec-hd { display: flex; align-items: baseline; justify-content: space-between; margin: 30px 0 14px; }
.sec-hd h2 { font-size: 19px; font-weight: 700; line-height: 1.2; }
.sec-hd h2::before { content: '#'; color: var(--primary); margin-right: 8px; font-weight: 800; }
.sec-hd .more { font-size: 13px; color: var(--text-2); }
.hero-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; }
.hero-main { position: relative; border-radius: 12px; overflow: hidden; display: block; aspect-ratio: 16 / 9; background: var(--bg-2); }
.hero-main img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .35s; }
.hero-main:hover img { transform: scale(1.03); }
.hero-main .hero-mask { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,.82)); }
.hero-main .hero-txt { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 20px; }
.hero-main h3 { font-size: 22px; font-weight: 700; color: #fff; line-height: 1.4; }
.hero-main .hero-sub { font-size: 13px; color: rgba(255,255,255,.75); margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hero-side { display: flex; flex-direction: column; gap: 12px; }
.hero-side a { display: flex; gap: 12px; background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; padding: 10px; align-items: center; }
.hero-side a:hover { border-color: var(--primary); }
.hero-side img { width: 108px; aspect-ratio: 16/10; object-fit: cover; border-radius: 6px; flex-shrink: 0; background: var(--bg); }
.hero-side .t { font-size: 14px; font-weight: 600; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hero-side time { display: block; font-size: 12px; color: var(--text-2); margin-top: 4px; }
.mag-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.mag-card { background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; position: relative; }
.mag-card:hover { border-color: var(--primary); }
.mag-card .cover { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; background: var(--bg); }
.mag-card .bd { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.mag-card h3 { font-size: 14px; font-weight: 600; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mag-card .meta { font-size: 12px; color: var(--text-2); margin-top: auto; display: flex; gap: 10px; }
.mag-card .rating-corner { position: absolute; top: 8px; right: 8px; background: var(--primary); color: #08110d; font-weight: 800; font-size: 15px; border-radius: 8px; padding: 2px 9px; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
.mag-card .chips { display: flex; gap: 5px; flex-wrap: wrap; }
.chip { font-size: 11px; color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); border-radius: 4px; padding: 1px 7px; }
.type-badge { position: absolute; top: 8px; left: 8px; font-size: 11px; color: #fff; background: rgba(0,0,0,.6); border-radius: 4px; padding: 2px 7px; backdrop-filter: blur(4px); }
.home-cols { display: grid; grid-template-columns: 8fr 4fr; gap: 24px; margin-top: 30px; }
.rank-list { background: var(--bg-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
.rank-list h2 { font-size: 16px; font-weight: 700; margin-bottom: 10px; line-height: 1.2; }
.rank-list h2::before { content: '#'; color: var(--primary); margin-right: 7px; font-weight: 800; }
.rank-list li { list-style: none; display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--border); font-size: 14px; align-items: baseline; }
.rank-list li:last-child { border-bottom: none; }
.rank-list .no { font-weight: 800; font-style: italic; color: var(--text-2); width: 20px; flex-shrink: 0; text-align: center; }
.rank-list li:nth-child(1) .no, .rank-list li:nth-child(2) .no, .rank-list li:nth-child(3) .no { color: var(--primary); }
.rank-list a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.article { max-width: 860px; margin: 0 auto; }
.article-hero { border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
.article-hero img { width: 100%; max-height: 420px; object-fit: cover; display: block; }
.article h1 { font-size: 28px; line-height: 1.45; font-weight: 800; margin-bottom: 12px; }
.article .meta { font-size: 13px; color: var(--text-2); display: flex; gap: 16px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
.review-panel { display: flex; gap: 18px; align-items: center; background: var(--bg-2); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
.review-score { font-size: 46px; font-weight: 900; color: var(--primary); line-height: 1; flex-shrink: 0; }
.review-score small { font-size: 14px; font-weight: 600; color: var(--text-2); display: block; text-align: center; margin-top: 4px; }
.review-facts { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; }
.review-facts .k { color: var(--text-2); margin-right: 6px; }
.article .body { font-size: 16px; }
.article .body p { margin: 13px 0; }
.article .body img { border-radius: 8px; }
.attachments { margin-top: 26px; padding-top: 14px; border-top: 1px solid var(--border); }
.attachments li { list-style: none; padding: 6px 0; font-size: 14px; }
.attachments .ext { font-size: 11px; font-weight: 700; background: var(--bg-2); color: var(--primary); border-radius: 3px; padding: 2px 6px; margin-right: 8px; }
.article-nav { max-width: 860px; margin: 24px auto 0; padding-top: 14px; border-top: 1px solid var(--border); font-size: 14px; color: var(--text-2); display: flex; flex-direction: column; gap: 6px; }
.related-articles { max-width: 860px; margin: 24px auto 0; }
.related-articles h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
.related-articles h3::before { content: '#'; color: var(--primary); margin-right: 7px; font-weight: 800; }
.related-articles li { list-style: none; padding: 5px 0; font-size: 14px; }
.related-articles li a::before { content: '#'; color: var(--primary); margin-right: 7px; }
.tags-row { max-width: 860px; margin: 18px auto 0; display: flex; gap: 8px; flex-wrap: wrap; }
.pagination { display: flex; gap: 6px; justify-content: center; margin-top: 26px; flex-wrap: wrap; }
.pagination a, .pagination span { padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--bg-2); }
.pagination .current { background: var(--primary); border-color: var(--primary); color: #08110d; font-weight: 700; }
.empty { text-align: center; color: var(--text-2); padding: 48px 0; }
.search-result mark { background: color-mix(in srgb, var(--primary) 30%, transparent); color: var(--primary); padding: 0 1px; border-radius: 2px; }
.content-list { display: flex; flex-direction: column; }
.content-item { display: flex; justify-content: space-between; gap: 16px; padding: 13px 2px; border-bottom: 1px dashed var(--border); font-size: 15px; }
.content-item a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.content-item time { color: var(--text-2); font-size: 13px; flex-shrink: 0; }
.mag-footer { border-top: 1px solid var(--border); background: var(--bg-2); padding: 26px 0; font-size: 13px; color: var(--text-2); }
.mag-footer a { color: var(--text-2); }
.mag-footer a:hover { color: var(--primary); }
.mag-footer .links { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
.mag-footer .extra { white-space: pre-line; margin-bottom: 8px; }
${MEDIA_BLOCK_STYLES}
.album-grid a { border-color: var(--border); }
@media (max-width: 900px) {
  .hero-grid, .home-cols { grid-template-columns: 1fr; }
  .mag-grid { grid-template-columns: repeat(2, 1fr); }
  .list-grid { grid-template-columns: repeat(2, 1fr); }
  .top-nav { display: none; }
}
@media (max-width: 560px) {
  .mag-grid, .list-grid { grid-template-columns: 1fr; }
}
@media print {
  .topbar, .mag-footer, .article-nav, .related-articles, .breadcrumbs { display: none !important; }
  body { background: #fff; color: #222; }
}
`;

const TYPE_LABELS: Record<string, string | null> = { article: null, album: '图集', media: '视频', link: '外链' };

// ─── 布局 ─────────────────────────────────────────────────────────────────────

function MagLayout({ ctx, currentUrl, children }: { ctx: CmsBaseContext; currentUrl?: string; children: ReactNode }) {
  const { site, nav, friendLinkGroups, baseUrl } = ctx;
  const theme = buildThemeOverrides(site.settings, '');
  const footerText = typeof site.themeConfig.footerText === 'string' ? site.themeConfig.footerText : null;
  return (
    <html lang="zh-CN">
      <SeoHead ctx={ctx} css={styles + theme.css} darkMode="light" langAlternates />
      <body>
        {ctx.analytics ? <script dangerouslySetInnerHTML={{ __html: buildAnalyticsBeacon(ctx.analytics) }} /> : null}
        <header className="topbar">
          <div className="w1200">
            <a className="brand" href={`${baseUrl}/`}>
              {site.logo ? <img src={site.logo} alt={site.name} /> : null}
              <span>{site.name}<span className="dot">.</span></span>
            </a>
            <nav className="top-nav">
              <a href={`${baseUrl}/`} className={currentUrl === `${baseUrl}/` ? 'active' : undefined}>首页</a>
              {nav.map((item) => (
                <a key={item.id} href={item.url} target={item.target} className={currentUrl === item.url ? 'active' : undefined}>
                  {item.name}
                </a>
              ))}
            </nav>
            <form className="top-search" action={ctx.searchUrl} method="get">
              <input type="search" name="q" placeholder="搜索游戏 / 文章" />
              <button type="submit">搜索</button>
            </form>
          </div>
        </header>
        <main>
          <div className="w1200">{children}</div>
        </main>
        <footer className="mag-footer">
          <div className="w1200">
            {friendLinkGroups.length > 0 ? (
              <div className="links">
                {friendLinkGroups.flatMap((group) => group.links).map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a>
                ))}
              </div>
            ) : null}
            {footerText ? <div className="extra">{footerText}</div> : null}
            <div>{site.copyright ?? `© ${new Date().getFullYear()} ${site.name}`}</div>
            {site.icp ? (
              <div><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{site.icp}</a></div>
            ) : null}
          </div>
        </footer>
      </body>
    </html>
  );
}

// ─── 公共片段 ─────────────────────────────────────────────────────────────────

function ratingFieldName(ctx: CmsBaseContext): string {
  return typeof ctx.site.themeConfig.ratingField === 'string' && ctx.site.themeConfig.ratingField.trim()
    ? ctx.site.themeConfig.ratingField.trim()
    : 'score';
}

/** 从模型字段中拆出评分字段：徽章单独渲染，其余字段照常展示 */
function splitRating(fields: CmsModelFieldValue[], ratingName: string): { rating: CmsModelFieldValue | null; rest: CmsModelFieldValue[] } {
  const rating = fields.find((f) => f.name === ratingName && f.displayValue !== '') ?? null;
  return { rating, rest: fields.filter((f) => f !== rating && f.displayValue !== '') };
}

function MagCard({ item, ratingName }: { item: CmsContentItem; ratingName: string }) {
  const { rating, rest } = splitRating(item.modelFields, ratingName);
  const typeLabel = TYPE_LABELS[item.contentType] ?? null;
  const cover = item.coverThumb ?? item.coverImage;
  return (
    <a className="mag-card" href={item.url} {...(item.isExternal ? { target: '_blank', rel: 'noopener nofollow' } : {})}>
      {cover ? <img className="cover" src={cover} alt={item.title} loading="lazy" /> : null}
      {typeLabel ? <span className="type-badge">{typeLabel}{item.contentType === 'album' && item.imageCount > 1 ? `·${item.imageCount}` : ''}</span> : null}
      {rating ? <span className="rating-corner">{rating.displayValue}</span> : null}
      <div className="bd">
        <h3>{item.title}</h3>
        {rest.length > 0 ? (
          <div className="chips">
            {rest.map((f) => <span key={f.name} className="chip" title={f.label}>{f.displayValue}</span>)}
          </div>
        ) : null}
        <div className="meta">
          {item.publishedAt ? <time>{item.publishedAt.slice(0, 10)}</time> : null}
          <span>{item.viewCount} 浏览</span>
        </div>
      </div>
    </a>
  );
}

function RankList({ title, items }: { title: string; items: CmsContentItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rank-list">
      <h2>{title}</h2>
      <ul>
        {items.slice(0, 10).map((item, i) => (
          <li key={item.id}>
            <span className="no">{i + 1}</span>
            <a href={item.url}>{item.title}</a>
          </li>
        ))}
      </ul>
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
    const ratingName = ratingFieldName(ctx);
    const [heroMain, ...heroSide] = ctx.latest;
    return (
      <MagLayout ctx={ctx} currentUrl={`${ctx.baseUrl}/`}>
        {heroMain ? (
          <div className="hero-grid">
            <a className="hero-main" href={heroMain.url}>
              {heroMain.coverImage ? <img src={heroMain.coverImage} alt={heroMain.title} /> : null}
              <span className="hero-mask" />
              <span className="hero-txt">
                <h3>{heroMain.title}</h3>
                {heroMain.summary ? <span className="hero-sub">{heroMain.summary}</span> : null}
              </span>
            </a>
            <div className="hero-side">
              {heroSide.slice(0, 4).map((item) => (
                <a key={item.id} href={item.url}>
                  {(item.coverThumb ?? item.coverImage) ? <img src={item.coverThumb ?? item.coverImage!} alt={item.title} loading="lazy" /> : null}
                  <span>
                    <span className="t">{item.title}</span>
                    {item.publishedAt ? <time>{item.publishedAt.slice(0, 10)}</time> : null}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <div className="home-cols">
          <div>
            {data.blocks.map((block) => (
              <section key={block.channel.code}>
                <div className="sec-hd">
                  <h2>{block.channel.name}</h2>
                  <a className="more" href={block.channel.url}>更多 →</a>
                </div>
                <div className="mag-grid">
                  {block.list.slice(0, 4).map((item) => <MagCard key={item.id} item={item} ratingName={ratingName} />)}
                </div>
              </section>
            ))}
            {data.blocks.length === 0 ? (
              <section>
                <div className="sec-hd"><h2>最新发布</h2></div>
                <div className="mag-grid">
                  {ctx.latest.slice(0, 8).map((item) => <MagCard key={item.id} item={item} ratingName={ratingName} />)}
                </div>
              </section>
            ) : null}
          </div>
          <aside>
            {ctx.homeSidebar ? <div dangerouslySetInnerHTML={{ __html: renderCmsWidgetHtml(ctx.homeSidebar) }} /> : null}
            <RankList title="热门排行" items={ctx.hot} />
          </aside>
        </div>
      </MagLayout>
    );
  },
});

// ─── 列表 / 详情 ──────────────────────────────────────────────────────────────

function ListTemplate(ctx: CmsListContext) {
  const ratingName = ratingFieldName(ctx);
  return (
    <MagLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <h1 className="page-title">{ctx.channel.name}</h1>
      {ctx.items.length === 0 ? <div className="empty">该栏目暂无内容</div> : (
        <div className="list-grid">
          {ctx.items.map((item) => <MagCard key={item.id} item={item} ratingName={ratingName} />)}
        </div>
      )}
      <Pagination p={ctx.pagination} />
    </MagLayout>
  );
}

function DetailTemplate(ctx: CmsDetailContext) {
  const { content } = ctx;
  const ratingName = ratingFieldName(ctx);
  const { rating, rest } = splitRating(content.modelFields, ratingName);
  return (
    <MagLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <article className="article">
        {content.coverImage && content.contentType === 'article' ? (
          <div className="article-hero"><img src={content.coverImage} alt={content.title} /></div>
        ) : null}
        <h1>{content.title}</h1>
        <div className="meta">
          {content.author ? <span>{content.author}</span> : null}
          {content.source ? <span>来源：{content.source}</span> : null}
          {content.publishedAt ? <time>{content.publishedAt}</time> : null}
          <span>{content.viewCount} 浏览</span>
        </div>
        {(rating || rest.length > 0) ? (
          <div className="review-panel">
            {rating ? (
              <div className="review-score">
                {rating.displayValue}
                <small>{rating.label}</small>
              </div>
            ) : null}
            <div className="review-facts">
              {rest.map((f) => (
                <span key={f.name}><span className="k">{f.label}</span>{f.displayValue}</span>
              ))}
            </div>
          </div>
        ) : null}
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
          <div className="tags-row">
            {content.tags.map((t) => <a key={t.slug} className="chip" href={t.url}>{t.name}</a>)}
          </div>
        ) : null}
      </article>
      {(content.prev || content.next) ? (
        <nav className="article-nav">
          {content.prev ? <span>上一篇：<a href={content.prev.url}>{content.prev.title}</a></span> : null}
          {content.next ? <span>下一篇：<a href={content.next.url}>{content.next.title}</a></span> : null}
        </nav>
      ) : null}
      {ctx.related.length > 0 ? (
        <section className="related-articles">
          <h3>相关阅读</h3>
          <ul>
            {ctx.related.map((r) => <li key={r.url}><a href={r.url}>{r.title}</a></li>)}
          </ul>
        </section>
      ) : null}
    </MagLayout>
  );
}

// ─── 单页 / 搜索 / 标签 / 404 ─────────────────────────────────────────────────

function PageTemplate(ctx: CmsPageContext) {
  return (
    <MagLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <article className="article">
        <h1>{ctx.channel.name}</h1>
        <div className="body" dangerouslySetInnerHTML={{ __html: ctx.contentHtml }} />
      </article>
    </MagLayout>
  );
}

function SearchTemplate(ctx: CmsSearchContext) {
  return (
    <MagLayout ctx={ctx}>
      <h1 className="page-title">搜索「{ctx.keyword}」</h1>
      <div className="content-list search-result">
        {ctx.results.length === 0 ? (
          <div className="empty">未找到相关内容</div>
        ) : ctx.results.map((r) => (
          <div className="content-item" key={r.id}>
            <a
              href={r.isExternal ? r.url : `${ctx.baseUrl}${r.url}`}
              {...(r.isExternal ? { target: '_blank', rel: 'noopener nofollow' } : {})}
              dangerouslySetInnerHTML={{ __html: r.titleHighlight }}
            />
            {r.publishedAt ? <time>{r.publishedAt.slice(0, 10)}</time> : null}
          </div>
        ))}
      </div>
      <Pagination p={ctx.pagination} />
    </MagLayout>
  );
}

function TagTemplate(ctx: CmsTagPageContext) {
  const ratingName = ratingFieldName(ctx);
  return (
    <MagLayout ctx={ctx}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <h1 className="page-title">#{ctx.tag.name}（{ctx.tag.contentCount}）</h1>
      {ctx.items.length === 0 ? <div className="empty">暂无内容</div> : (
        <div className="list-grid">
          {ctx.items.map((item) => <MagCard key={item.id} item={item} ratingName={ratingName} />)}
        </div>
      )}
      <Pagination p={ctx.pagination} />
    </MagLayout>
  );
}

function NotFoundTemplate(ctx: CmsNotFoundContext) {
  return (
    <MagLayout ctx={ctx}>
      <div className="empty">
        <h1 className="page-title">404 页面不存在</h1>
        <p>您访问的页面不存在或已被移除：{ctx.path}</p>
        <p><a href={`${ctx.baseUrl}/`} style={{ color: 'var(--primary)' }}>返回首页</a></p>
      </div>
    </MagLayout>
  );
}

// ─── 主题注册 ─────────────────────────────────────────────────────────────────

export const magazineTheme: CmsTheme = {
  code: 'magazine',
  label: '资讯杂志',
  templates: {
    index: HomeTemplate,
    list: ListTemplate,
    detail: DetailTemplate,
    page: PageTemplate,
    search: SearchTemplate,
    tag: TagTemplate,
    notFound: NotFoundTemplate,
  },
  settingsSchema: [
    { name: 'homeChannels', label: '首页栏目区块', fieldType: 'text', group: '首页', placeholder: '如 reviews,news,guides', description: '逗号分隔栏目标识（最多 6 个），每个渲染一行 4 张卡片；留空回落全站最新发布' },
    { name: 'ratingField', label: '评分字段标识', fieldType: 'text', group: '内容', placeholder: 'score', description: '内容模型中作为评分的字段标识：详情页渲染大评分徽章、卡片渲染角标；留空默认 score' },
    { name: 'footerText', label: '页脚附加文案', fieldType: 'textarea', group: '页脚', placeholder: '联系邮箱、合作信息等，支持多行' },
  ],
  widgetSlots: [{
    key: 'home.sidebar',
    label: '首页侧栏',
    allowedTypes: ['manual-list'],
    rendererKeys: [...CMS_WIDGET_RENDERER_KEYS],
  }],
};
