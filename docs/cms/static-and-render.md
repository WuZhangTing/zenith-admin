# 渲染与静态化

前台页面由 **React SSR**（`renderToStaticMarkup`）渲染，配合三种静态化模式与多层缓存。

## 站点路由

- **域名模式**：前台按请求 Host 精确匹配站点 `domain` / `aliasDomains`，未命中回退默认站点（`isDefault`）
- **预览模式**：`/__cms/{siteCode}/...` 前缀直达任意站点（跳过静态缓存，后台改动即时可见）
- **多域名**：同一站点绑多个域名走 `aliasDomains`；设备差异由响应式主题的 CSS 断点解决，不做服务端 UA 分支（静态产物按 URL 缓存，按 UA 分叉要么废掉 CDN 缓存、要么产生重复内容）。若确需 PC/移动两套完全不同的前台，建子站点 + 站群映射分发

## URL 规则

| 页面 | URL |
|------|-----|
| 首页 | `/`（可被「页面搭建」isHome 页面接管） |
| 栏目列表 | `/{channelPath}/`，分页 `/{channelPath}/index_{n}.html` |
| 内容详情 | `/{channelPath}/{归档目录}{idOrSlug}.html`，正文多页 `/{channelPath}/{归档目录}{idOrSlug}_{n}.html`；内容设了 `staticPath` 时改用该相对路径（分页在扩展名前追加 `_{n}`）。归档目录见「详情页目录归档」 |
| 标签聚合 | `/tag/{slug}/` |
| 搭建页面 | `/p/{slug}/`，或页面自定义的 `path`（如 `/about.html`、`/zh/about/`） |
| 互动问卷 | `/interaction/{code}/` |
| 搜索 | `/search?q=`（永远动态） |
| 草稿预览 | `/preview/{id}?exp=&sig=`（签名校验） |
| 站点资源 | `/sitemap.xml`、`/robots.txt`、`/rss.xml`、`/{channelPath}/rss.xml` |

## 静态化三模式

站点 `staticMode` 决定渲染策略：

| 模式 | 行为 | 适用 |
|------|------|------|
| `dynamic` | 纯 SSR + Redis 页面缓存 | 内容高频变化 |
| `hybrid`（默认） | 静态文件命中直返；miss 时 SSR 渲染并**回写**静态文件 | 通用推荐 |
| `static` | 仅发布时生成，miss 不回写 | 高安全静态托管 |

静态产物：首页、栏目全分页（上限 50 页）、详情页、标签页、搭建页、`sitemap.xml`（5 万条上限）、`robots.txt`、RSS。写入采用 `.tmp` + rename 原子操作。产物统一落在 `{siteCode}/` 单棵树下。dynamic 模式 Redis 页面缓存 key 为 `cms:page:{siteId}:{path}`。

### 栏目级静态化开关

栏目 `staticMode` 可逐栏目覆盖站点设置：

| 值 | 行为 |
|------|------|
| `inherit`（默认） | 跟随站点 `staticMode` |
| `dynamic` | 本栏目**不产出**任何静态文件（列表页、详情页均走 SSR），站点其余栏目不受影响 |
| `hybrid` / `static` | 覆盖站点设置，语义同上表 |

生效点：增量刷新（`refreshContentStatic`）、快照发布（`applyCmsContentPublishSnapshot`）、栏目重建与全量构建（`buildSiteStatic`）。切为 `dynamic` 后，历史产物在下一次内容变更的删除阶段被清理。链接型栏目（`type=link`）本来就不生成静态文件，不展示该选项。

### 发布时重建页数上限

站点 `settings.maxPageOnContentPublish`（内容策略）限制**单条内容发布/更新**时重建所属栏目的列表页数（默认 `0` = 全部重建，上限同 50 页）。仅作用于增量刷新路径；栏目级重建与全量构建始终生成全部分页。超出页数的历史分页文件仍会正常清理，不会残留。

### 详情页目录归档

栏目 `detailPathRule` 决定详情页静态产物落在栏目路径下的哪一级子目录，用于把海量内容打散、避免单目录文件过多：

| 规则 | 产出目录（以栏目 `news`、发布于 2026-07-05 的内容 #42 为例） |
|------|------|
| `none`（默认） | `/news/42.html` |
| `year` | `/news/2026/42.html` |
| `month` | `/news/2026/7/42.html` |
| `date` | `/news/2026/7/5/42.html` |
| `dateStr` | `/news/2026-07-05/42.html`（补零，目录名等宽便于排序） |
| `idHash` | `/news/2/42.html`（`id % 10` 分 10 桶，不依赖时间） |

优先级与边界：

- 内容自填 `staticPath` **完全绕过**本规则
- 日期类规则取 `publishedAt`，未发布时回退 `createdAt`；两者都缺失则退化为不归档，不会产生 `undefined` 目录
- 规则由 `contentUrl()` 统一计算，静态化写文件与模板生成链接共用同一函数，不存在两侧算不一致的可能

> ⚠️ **改动规则会使旧产物成为孤儿**。栏目保存会触发整站重建，新路径产物即时生成；旧路径下的文件由重建结束时的**孤儿清扫**自动删除（见下），无需手工清理。若需保留旧 URL 可访问，请在「SEO 管理 → 301 重定向」中配置跳转。

### 孤儿产物清扫

静态产物的路径由栏目路径、归档规则、内容 slug/staticPath 等共同决定，任何一项变更都会让旧路径下的文件失去归属。**整站重建结束时会自动清扫这些孤儿**：

- **mark**：构建过程中用 AsyncLocalStorage 收集本次写入的全部相对路径
- **sweep**：递归遍历站点静态目录，删除不在写入集合中的文件，并自底向上回收空目录
- 删除走 `deleteStaticFile`，因此同样受发布围栏保护，且每个被删文件都会落一条 `deleted` 产物记录，可在发布中心审计
- 清扫数量回填任务结果 `prunedArtifacts`

**触发时机**：任意整站重建。栏目改路径/改归档规则、站点改主题等操作本身就会触发整站重建，因此保存后即自愈，无需额外动作。

**安全边界**：

| 情形 | 行为 |
| --- | --- |
| 断点续跑的构建（`resumeAfterKey` 非空） | **跳过清扫** —— 续跑只写了后半程，集合不完整，清扫会误删前半程的有效产物 |
| 被取消的构建 | **跳过清扫**（提前返回一律 `pruned: 0`） |
| 内容级 / 栏目级增量刷新 | 不清扫，仅按快照 `deletePaths` 精确删除旧路径 |
| hybrid 按需回写的深分页（如标签页第 2 页） | 会被清扫；下次访问自动重新生成。`static` 模式下这类页面本就不生成，无影响 |

> 路径归一化复用 `pathToStaticFile`：写入侧记录的是 URL 形态（`news/`、``），磁盘上是 `news/index.html`、`index.html`。两侧若不用同一套映射，首页与全部栏目页会被误判成孤儿。

### 页面区块展示条件的静态安全策略

区块只支持公开且非敏感的 `always`、`guest`、`member` 与可组合时间窗。出现 `guest/member` 或 `startAt/endAt` 时，页面写入自动标记 `requiresDynamic=true`：

- 全量/增量静态构建删除并跳过该页面的静态文件，hybrid miss 也不回写，共享 Redis 页面缓存同样跳过。
- 首次导航只渲染游客可见区块；浏览器若存在会员 token，会用 Bearer 对同 URL 发起 `no-store` 请求，服务端经 optional member auth 重新渲染会员版本后替换文档。
- 会员响应使用 `private, no-store` 与 `Vary: Authorization, Cookie`。JWT、JTI 黑名单、Redis 会话或会员状态任一校验失败均保留游客版本。
- 时间条件在服务端过滤；未到 `startAt` 或已过 `endAt` 的内容不会进入 HTML。为避免静态文件跨越时间边界后泄露，含 dateRange 的页面采用 dynamic；仅纯 `always` 页面进入静态产物。角色/权限/私密字段不属于展示条件 DSL。

## 增量刷新

内容发布/更新/下线/回收、评论过审、搭建页保存等操作自动触发**增量静态刷新**（详情页 + 所属栏目全分页 + 首页 + sitemap + RSS），异步执行不阻塞请求。新提交的全量重建统一走任务中心 `cms-publish-build`；`cms-static-build` 仅保留为存量任务兼容类型。

## 缓存分级与协商缓存

SSR 响应按页面类型分级缓存：

| 页面类型 | dynamic 模式 Redis TTL / Cache-Control max-age |
|----------|------------------------------------------------|
| 详情页 | 600s |
| 首页 / 单页 | 300s |
| 栏目列表 | 180s |
| 其他 | 60s |

所有 HTML 响应附带**弱 ETag**，命中 `If-None-Match` 返回 **304**，CDN 与浏览器可协商缓存。浏览计数经 Redis 缓冲聚合（`cms:viewbuf`），每分钟批量落库，避免高并发行锁排队。

## 主题与模板解析

前台外观由**主题**决定（内置 `default` / `docs` / `gov-portal` / `magazine` 四套，全部为仓库内 React TSX 组件，服务端 SSR 渲染）。主题体系——主题注册、Theme API 首页取数、主题参数（settingsSchema）、变体模板与解析链、共享组件、模型字段消费、部件插槽——完整说明见 **[主题与模板开发](./themes)**。

与渲染管线相关的两个事实：

- 站点切换主题时服务端校验主题已注册并原子递增 `themeRevision`，发布任务以此做**过期栅栏**——执行中发现站点主题/模板已变更即失效退出
- 模板解析链为 内容/栏目级覆盖 → 站点有效 `defaultTemplates`（经站群继承 resolver）→ 主题默认；主题升级导致的失效模板引用在站点保存时自动摘除（自愈机制见[主题文档](./themes#变体模板与解析链)）

## 页面部件与主题插槽

「页面部件」（`/cms/widgets`，权限 `cms:widget:list|create|update|publish|offline|delete|bind`）是可复用的内容块：在一处维护榜单/推荐位，多个页面位置引用，内容变化时**只定向刷新引用位置**，不触发整站重建。

### 数据与状态

- 类型目前为 `manual-list`（手工榜单）；条目来源三种：`manual`（手填标题/链接）、`content`（引用站内已发布内容）、`channel`（引用启用中栏目的最新内容，**实时来源**——渲染时动态取数）
- **草稿/发布双份数据**：编辑改 `draftData`（`draftRevision` 乐观锁，版本不符 409）；「发布」将草稿快照为 `publishedData`，前台只渲染发布快照。状态机 `draft → published → offline`，下线后可再发布
- 引用校验：条目引用的内容必须已发布、栏目必须启用；反向地，**删除内容 / 停用栏目时若仍被已发布部件引用会被 409 阻断**，需先下线或调整部件
- 展示模板（renderer）：`list-sidebar`（侧栏榜单）/ `list-grid`（网格卡片）/ `list-carousel`（轮播），部件设默认模板，引用处可覆盖
- 表：`cms_widgets` / `cms_widget_refs`（被引用索引，`ownerType: page | theme_slot`）/ `cms_widget_source_refs`（实时来源反向索引）

### 两种引用位置

| 引用方式 | 说明 |
|---|---|
| 页面搭建 `widget-ref` 区块 | 搭建页面中插入部件（`ownerType=page`），随页面静态化输出 |
| 主题插槽绑定 | `PUT /api/cms/widgets/slots/{slotKey}`（权限 `cms:widget:bind`），把**已发布**部件绑到主题声明的插槽上；插槽清单由主题注册表 `widgetSlots` 声明（四套内置主题均提供 `home.sidebar` 首页侧栏），并校验部件类型与模板是否适用 |

编辑页提供 `GET /{id}/preview`（草稿/发布态渲染预览）与 `GET /{id}/refs`（引用位置清单）；列表以 `referenceCount/impactCount` 展示引用面，达到高扇出阈值（20 个引用位置）标记 `highFanout` 提醒操作影响面。

### 定向刷新

部件发布/下线（含批量任务 `cms-widget-batch`）自动提交任务中心 `cms-widget-refresh`，按引用索引定向刷新：重建引用页面与相关首页的静态产物、清理对应 Redis 页面缓存（`cms:page:{siteId}:{path}`）、dynamic 站点触发 CDN purge。同站点连续操作按 **5 秒时间桶去抖合并**为一次刷新。`content`/`channel` 实时来源的部件在来源内容发布/更新/下线、栏目变更时同样经 `cms_widget_source_refs` 反查并触发刷新，保证静态页上的榜单不滞后。
