/**
 * gov-portal 政府门户主题：以 Theme API（defineHomeTemplate + CmsThemeDataApi）实现的
 * 标准政府门户形态——大页头 + 主导航横条 + 双栏首页（要闻区块 / 公告侧栏）+
 * 图标办事入口 + 紧凑公文列表 + 政策文件详情（文件信息表头）。
 *
 * 同时作为 Theme API 的验收用例与主题开发的实例源码。
 */
import type { ReactNode } from 'react';
import type {
  CmsBaseContext, CmsContentItem, CmsListContext, CmsDetailContext,
  CmsPageContext, CmsSearchContext, CmsTagPageContext, CmsNotFoundContext,
  CmsTheme, CmsThemeContentCollection,
} from '../types';
import { SeoHead, Breadcrumbs, Pagination, ModelFieldTable, MODEL_FIELD_TABLE_STYLES, buildAnalyticsBeacon, buildThemeOverrides } from '../_shared';
import { defineHomeTemplate } from '../sdk';
import { renderCmsWidgetHtml } from '../widgets';
import { CMS_WIDGET_RENDERER_KEYS } from '@zenith/shared/cms';

const styles = `
:root { --primary: #b8161a; --text: #333; --text-2: #737a87; --border: #e3e6ec; --bg: #ffffff; --bg-2: #f5f6f8; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif; color: var(--text); background: var(--bg); line-height: 1.7; }
a { color: inherit; text-decoration: none; }
a:hover { color: var(--primary); }
img { max-width: 100%; }
.w1200 { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.masthead { background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 6%, #fff), #fff); border-bottom: 3px solid var(--primary); }
.masthead .w1200 { display: flex; align-items: center; justify-content: space-between; padding-top: 26px; padding-bottom: 22px; gap: 24px; flex-wrap: wrap; }
.masthead-brand { display: flex; align-items: center; gap: 14px; }
.masthead-brand img { height: 56px; }
.masthead-title { font-size: 30px; font-weight: 700; letter-spacing: 2px; color: var(--primary); }
.masthead-sub { font-size: 13px; color: var(--text-2); letter-spacing: 4px; margin-top: 2px; }
.masthead-search { display: flex; }
.masthead-search input { border: 1px solid var(--border); border-right: none; border-radius: 4px 0 0 4px; padding: 9px 14px; font-size: 14px; width: 240px; outline: none; }
.masthead-search button { background: var(--primary); color: #fff; border: none; border-radius: 0 4px 4px 0; padding: 0 20px; font-size: 14px; cursor: pointer; }
.main-nav { background: var(--primary); }
.main-nav .w1200 { display: flex; overflow-x: auto; }
.main-nav a { color: #fff; font-size: 16px; padding: 13px 26px; white-space: nowrap; }
.main-nav a.active, .main-nav a:hover { background: rgba(0,0,0,.18); color: #fff; }
main { min-height: 60vh; padding: 22px 0 44px; }
.breadcrumbs { font-size: 13px; color: var(--text-2); margin-bottom: 14px; }
.breadcrumbs a { color: var(--text-2); }
.page-title { font-size: 21px; font-weight: 600; margin-bottom: 14px; color: var(--primary); }
.gov-grid { display: grid; grid-template-columns: 7fr 5fr; gap: 26px; }
.gov-box { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 22px; overflow: hidden; }
.gov-box-hd { display: flex; align-items: center; justify-content: space-between; background: var(--bg-2); border-bottom: 1px solid var(--border); padding: 0 14px; }
.gov-box-hd h2 { font-size: 16px; font-weight: 600; padding: 10px 2px 8px; border-bottom: 2px solid var(--primary); margin-bottom: -1px; color: var(--primary); }
.gov-box-hd .more { font-size: 12px; color: var(--text-2); }
.gov-box-bd { padding: 8px 14px 12px; }
.gov-list li { list-style: none; display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dashed var(--border); font-size: 15px; }
.gov-list li:last-child { border-bottom: none; }
.gov-list li a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gov-list li a::before { content: '·'; color: var(--primary); font-weight: 700; margin-right: 7px; }
.gov-list li time { color: var(--text-2); font-size: 13px; flex-shrink: 0; }
.gov-list .top-badge { display: inline-block; font-size: 11px; color: #fff; background: var(--primary); border-radius: 3px; padding: 0 5px; margin-right: 6px; vertical-align: 1px; }
.svc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
.svc-grid a { display: flex; flex-direction: column; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 6px; padding: 18px 8px 14px; font-size: 14px; background: var(--bg); }
.svc-grid a:hover { border-color: var(--primary); color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.svc-grid .svc-ico { width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb, var(--primary) 10%, #fff); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; }
.content-list { display: flex; flex-direction: column; }
.content-item { display: flex; justify-content: space-between; gap: 16px; padding: 13px 2px; border-bottom: 1px dashed var(--border); font-size: 15px; }
.content-item a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.content-item a::before { content: '·'; color: var(--primary); font-weight: 700; margin-right: 7px; }
.content-item time { color: var(--text-2); font-size: 13px; flex-shrink: 0; }
.article { max-width: 900px; margin: 0 auto; }
.article h1 { font-size: 26px; line-height: 1.5; text-align: center; margin: 8px 0 14px; }
.article .meta { font-size: 13px; color: var(--text-2); display: flex; gap: 18px; justify-content: center; flex-wrap: wrap; padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
.article .body { font-size: 16px; }
.article .body p { margin: 13px 0; }
.article-nav { max-width: 900px; margin: 22px auto 0; padding-top: 14px; border-top: 1px solid var(--border); font-size: 14px; color: var(--text-2); display: flex; flex-direction: column; gap: 6px; }
.attachments { margin-top: 26px; padding-top: 14px; border-top: 1px solid var(--border); }
.attachments li { list-style: none; padding: 6px 0; font-size: 14px; }
.attachments .ext { font-size: 11px; font-weight: 600; background: var(--bg-2); color: var(--text-2); border-radius: 3px; padding: 2px 6px; margin-right: 8px; }
.pagination { display: flex; gap: 6px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
.pagination a, .pagination span { padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px; font-size: 14px; }
.pagination .current { background: var(--primary); border-color: var(--primary); color: #fff; }
.empty { text-align: center; color: var(--text-2); padding: 44px 0; }
.search-result mark { background: #ffe9a8; color: #8a4b00; padding: 0 1px; }
.gov-footer { background: #2d3138; color: #b6bcc6; padding: 26px 0; font-size: 13px; }
.gov-footer a { color: #b6bcc6; }
.gov-footer a:hover { color: #fff; }
.gov-footer .links { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 10px; }
.gov-footer .extra { white-space: pre-line; margin-bottom: 8px; }
${MODEL_FIELD_TABLE_STYLES}
.model-fields-table th { background: color-mix(in srgb, var(--primary) 5%, #fff); }
@media (max-width: 768px) {
  .masthead-title { font-size: 22px; }
  .masthead-search { display: none; }
  .gov-grid { grid-template-columns: 1fr; }
  .svc-grid { grid-template-columns: repeat(2, 1fr); }
}
`;

// ─── 布局 ─────────────────────────────────────────────────────────────────────

function GovLayout({ ctx, currentUrl, children }: { ctx: CmsBaseContext; currentUrl?: string; children: ReactNode }) {
  const { site, nav, friendLinkGroups, baseUrl } = ctx;
  const theme = buildThemeOverrides(site.settings, '');
  const footerText = typeof site.themeConfig.footerText === 'string' ? site.themeConfig.footerText : null;
  const subTitle = typeof site.themeConfig.mastheadSubtitle === 'string' ? site.themeConfig.mastheadSubtitle : '';
  return (
    <html lang="zh-CN">
      <SeoHead ctx={ctx} css={styles + theme.css} darkMode="light" langAlternates />
      <body>
        {ctx.analytics ? <script dangerouslySetInnerHTML={{ __html: buildAnalyticsBeacon(ctx.analytics) }} /> : null}
        <header className="masthead">
          <div className="w1200">
            <a className="masthead-brand" href={`${baseUrl}/`}>
              {site.logo ? <img src={site.logo} alt={site.name} /> : null}
              <span>
                <span className="masthead-title">{site.name}</span>
                {subTitle ? <div className="masthead-sub">{subTitle}</div> : null}
              </span>
            </a>
            <form className="masthead-search" action={ctx.searchUrl} method="get">
              <input type="search" name="q" placeholder="请输入关键词" />
              <button type="submit">搜索</button>
            </form>
          </div>
        </header>
        <nav className="main-nav">
          <div className="w1200">
            <a href={`${baseUrl}/`} className={currentUrl === `${baseUrl}/` ? 'active' : undefined}>首页</a>
            {nav.map((item) => (
              <a key={item.id} href={item.url} target={item.target} className={currentUrl === item.url ? 'active' : undefined}>
                {item.name}
              </a>
            ))}
          </div>
        </nav>
        <main>
          <div className="w1200">{children}</div>
        </main>
        <footer className="gov-footer">
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

function GovList({ items, showTop = false }: { items: CmsContentItem[]; showTop?: boolean }) {
  if (items.length === 0) return <div className="empty">暂无内容</div>;
  return (
    <ul className="gov-list">
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.url} {...(item.isExternal ? { target: '_blank', rel: 'noopener nofollow' } : {})}>
            {showTop && item.isTop ? <span className="top-badge">置顶</span> : null}
            {item.title}
          </a>
          {item.publishedAt ? <time>{item.publishedAt.slice(0, 10)}</time> : null}
        </li>
      ))}
    </ul>
  );
}

function GovBox({ title, moreUrl, children }: { title: string; moreUrl?: string | null; children: ReactNode }) {
  return (
    <section className="gov-box">
      <div className="gov-box-hd">
        <h2>{title}</h2>
        {moreUrl ? <a className="more" href={moreUrl}>更多 +</a> : null}
      </div>
      <div className="gov-box-bd">{children}</div>
    </section>
  );
}

/** 主题参数「办事入口」解析：每行 名称|URL */
function parseServiceLinks(raw: unknown): { name: string; url: string }[] {
  if (typeof raw !== 'string') return [];
  return raw.split('\n')
    .map((line) => {
      const [name, url] = line.split('|', 2).map((part) => part?.trim() ?? '');
      return { name, url };
    })
    .filter((entry) => entry.name && entry.url)
    .slice(0, 8);
}

// ─── 首页（Theme API：load 声明式取数）────────────────────────────────────────

type HomeBlock = CmsThemeContentCollection & { channel: NonNullable<CmsThemeContentCollection['channel']> };

const HomeTemplate = defineHomeTemplate({
  load: async ({ cms, site }) => {
    const raw = typeof site.themeConfig.homeChannels === 'string' ? site.themeConfig.homeChannels : '';
    const codes = raw.split(/[,，]/).map((code) => code.trim()).filter(Boolean).slice(0, 6);
    const blocks = await Promise.all(codes.map((code) => cms.contents.list({ channelCode: code, limit: 9 })));
    return { blocks: blocks.filter((block): block is HomeBlock => block.channel !== null) };
  },
  Component: ({ data, ...ctx }) => {
    const [primary, ...rest] = data.blocks;
    const services = parseServiceLinks(ctx.site.themeConfig.serviceLinks);
    return (
      <GovLayout ctx={ctx} currentUrl={`${ctx.baseUrl}/`}>
        {services.length > 0 ? (
          <div className="svc-grid">
            {services.map((svc) => (
              <a key={svc.url} href={svc.url} target="_blank" rel="noopener noreferrer">
                <span className="svc-ico">{svc.name.slice(0, 1)}</span>
                <span>{svc.name}</span>
              </a>
            ))}
          </div>
        ) : null}
        <div className="gov-grid">
          <div>
            {primary ? (
              <GovBox title={primary.channel.name} moreUrl={primary.channel.url}>
                <GovList items={primary.list} showTop />
              </GovBox>
            ) : (
              <GovBox title="最新发布">
                <GovList items={ctx.latest} showTop />
              </GovBox>
            )}
          </div>
          <aside>
            {ctx.homeSidebar ? <div dangerouslySetInnerHTML={{ __html: renderCmsWidgetHtml(ctx.homeSidebar) }} /> : null}
            {rest.map((block) => (
              <GovBox key={block.channel.code} title={block.channel.name} moreUrl={block.channel.url}>
                <GovList items={block.list.slice(0, 6)} />
              </GovBox>
            ))}
            {rest.length === 0 && ctx.hot.length > 0 ? (
              <GovBox title="热点关注">
                <GovList items={ctx.hot} />
              </GovBox>
            ) : null}
          </aside>
        </div>
      </GovLayout>
    );
  },
});

// ─── 列表页 ───────────────────────────────────────────────────────────────────

function ListTemplate(ctx: CmsListContext) {
  return (
    <GovLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <GovBox title={ctx.channel.name}>
        <GovList items={ctx.items} showTop />
      </GovBox>
      <Pagination p={ctx.pagination} />
    </GovLayout>
  );
}

// ─── 详情页 ───────────────────────────────────────────────────────────────────

function DetailTemplate(ctx: CmsDetailContext) {
  const { content } = ctx;
  return (
    <GovLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <article className="article">
        <h1>{content.title}</h1>
        <div className="meta">
          {content.source ? <span>来源：{content.source}</span> : null}
          {content.author ? <span>作者：{content.author}</span> : null}
          {content.publishedAt ? <time>发布时间：{content.publishedAt}</time> : null}
          <span>浏览：{content.viewCount}</span>
        </div>
        {content.modelFields.length > 0 ? <ModelFieldTable fields={content.modelFields} /> : null}
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
      </article>
      {(content.prev || content.next) ? (
        <nav className="article-nav">
          {content.prev ? <span>上一篇：<a href={content.prev.url}>{content.prev.title}</a></span> : null}
          {content.next ? <span>下一篇：<a href={content.next.url}>{content.next.title}</a></span> : null}
        </nav>
      ) : null}
    </GovLayout>
  );
}

// ─── 单页 / 搜索 / 标签 / 404 ─────────────────────────────────────────────────

function PageTemplate(ctx: CmsPageContext) {
  return (
    <GovLayout ctx={ctx} currentUrl={ctx.channel.url}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <article className="article">
        <h1>{ctx.channel.name}</h1>
        <div className="body" dangerouslySetInnerHTML={{ __html: ctx.contentHtml }} />
      </article>
    </GovLayout>
  );
}

function SearchTemplate(ctx: CmsSearchContext) {
  return (
    <GovLayout ctx={ctx}>
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
    </GovLayout>
  );
}

function TagTemplate(ctx: CmsTagPageContext) {
  return (
    <GovLayout ctx={ctx}>
      <Breadcrumbs items={ctx.breadcrumbs} />
      <GovBox title={`标签：${ctx.tag.name}（${ctx.tag.contentCount}）`}>
        <GovList items={ctx.items} />
      </GovBox>
      <Pagination p={ctx.pagination} />
    </GovLayout>
  );
}

function NotFoundTemplate(ctx: CmsNotFoundContext) {
  return (
    <GovLayout ctx={ctx}>
      <div className="empty">
        <h1 className="page-title">404 页面不存在</h1>
        <p>您访问的页面不存在或已被移除：{ctx.path}</p>
        <p><a href={`${ctx.baseUrl}/`} style={{ color: 'var(--primary)' }}>返回首页</a></p>
      </div>
    </GovLayout>
  );
}

// ─── 主题注册 ─────────────────────────────────────────────────────────────────

export const govPortalTheme: CmsTheme = {
  code: 'gov-portal',
  label: '政府门户',
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
    'list-compact': { label: '紧凑公文列表', component: ListTemplate },
  },
  extraDetailTemplates: {
    'detail-policy': { label: '政策文件（文件信息表头）', component: DetailTemplate },
  },
  settingsSchema: [
    { name: 'mastheadSubtitle', label: '页头副标题', fieldType: 'text', group: '页头', placeholder: '如拼音或英文站名', description: '站名下方的小字，留空不显示' },
    { name: 'homeChannels', label: '首页栏目区块', fieldType: 'text', group: '首页', placeholder: '如 yaowen,tzgg,zcwj', description: '逗号分隔栏目标识（最多 6 个）：第 1 个为主栏要闻区块，其余进右侧栏；留空回落全站最新发布' },
    { name: 'serviceLinks', label: '办事入口', fieldType: 'textarea', group: '首页', placeholder: '每行一个：名称|链接\n如 政务服务大厅|https://zwfw.example.gov.cn', description: '首页顶部图标导航（最多 8 个），留空不显示' },
    { name: 'footerText', label: '页脚附加文案', fieldType: 'textarea', group: '页脚', placeholder: '主办单位、承办单位、联系电话等，支持多行' },
  ],
  widgetSlots: [{
    key: 'home.sidebar',
    label: '首页侧栏',
    allowedTypes: ['manual-list'],
    rendererKeys: [...CMS_WIDGET_RENDERER_KEYS],
  }],
};
