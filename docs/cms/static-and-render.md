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

SSR 响应按页面类型分级缓存（v1.6.0+）：

| 页面类型 | dynamic 模式 Redis TTL / Cache-Control max-age |
|----------|------------------------------------------------|
| 详情页 | 600s |
| 首页 / 单页 | 300s |
| 栏目列表 | 180s |
| 其他 | 60s |

所有 HTML 响应附带**弱 ETag**，命中 `If-None-Match` 返回 **304**，CDN 与浏览器可协商缓存。浏览计数经 Redis 缓冲聚合（`cms:viewbuf`），每分钟批量落库，避免高并发行锁排队。

## 主题与模板解析

内置可信主题注册于 `packages/server/src/cms/themes/registry.ts`（`default` 企业门户 / `docs` 文档站），全部为仓库内 React TSX 组件，由服务端 SSR（`renderToStaticMarkup`）渲染。站点在「站点管理」编辑中选择主题，切换时服务端校验主题已注册并原子递增 `themeRevision`（发布任务以此做过期栅栏）。模板上下文含导航、广告位、友链、SEO、评论、相关文章等。

主题除默认模板集外可注册**变体模板**（`extraListTemplates` / `extraDetailTemplates`，带展示名），default 主题内置 `list-card`（卡片网格）、`list-compact`（紧凑标题）、`detail-plain`（简洁正文）。可选清单通过 `GET /api/cms/sites/themes/{code}/templates` 返回，后台站点/栏目/内容三级下拉动态取。

**模板解析链**（按优先级，空值逐级回退）：

| 页面 | 解析顺序 |
|------|----------|
| 列表页 | 栏目 `listTemplate` → 站点 `settings.defaultTemplates.list` → 主题默认 |
| 详情页 | 内容 `detailTemplate` → 栏目 `detailTemplate` → 站点 `defaultTemplates.detailByModel[模型code]` → 站点 `defaultTemplates.detail` → 主题默认 |

站点级默认模板在站点编辑 →「模板与主题」页签配置，**支持按内容模型细分详情模板**；栏目级在栏目编辑「模板配置」区配置列表/详情两项。

栏目级不提供「按模型细分」：详情页只在内容主栏目路径下可达（`getPublishedContent` 锁 `channel_id`），而内容 `model_id` 恒等于其主栏目的 `model_id` —— 栏目内模型唯一，按模型细分会退化成 `detailTemplate` 的重复槽位，还会在栏目编辑页列出该栏目永远命中不了的其他模型。站点默认跨栏目生效、模型有区分度，故只在站点级保留。

### 失效模板引用的自愈

模板配置存的是模板名字符串，与代码中的主题注册表之间没有引用完整性约束：**主题升级移除某个变体后，站点里的历史引用就变成了死配置**。

由于站点保存是按**合并后的完整 settings** 做校验（保证不会持久化非法状态），这类存量脏数据会连带卡住该站点所有与模板无关的 settings 写入（如内容策略开关），报错形如「站点默认模板[pc]列表模板「xxx」在主题「default」中不存在」。

处理策略分两种情形：

| 情形 | 行为 |
| --- | --- |
| 本次请求**未改动**、但已在当前主题下失效的引用 | 保存前自动摘除（`pruneStaleTemplateDefaults`），并记 `warn` 日志列出被清除项 |
| 本次请求**新提交/改动**的失效模板名 | 仍抛 400 并附可用模板清单，保留对拼写错误的即时反馈 |

因此任意一次站点保存（含只改无关字段的 API 局部更新）都会顺带修复该站点的存量脏引用，无需手工清库。后台站点编辑页同样会提示「已清除 N 项在主题「x」下失效的默认模板配置（保存后生效）」。全站存量扫描见 `getSiteTemplateHealth`（站点管理页健康检查 Banner）。
