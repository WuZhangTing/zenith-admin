# 开放能力（Headless API）

CMS 内容可通过开放平台网关以 **Headless** 方式供外部系统消费：读取走查询 DSL 与增量同步，
写入走受治理的双向接口，变更通过 Webhook 实时外推。本篇只说明 CMS 侧资源语义；应用、签名、限流、配额、Webhook 投递与调试台能力见 [开放平台](/open-platform/)。

所有端点使用与后台一致的 `defineOpenAPIRoute` + Zod 定义，因此会进入 Swagger（`/api/docs`），
客户端可直接由 `openapi.json` 生成 SDK。

## 接入方式

走开放平台标准链路：创建开发者应用 → 授权 scope → HMAC 签名调用（经鉴权/计量/限流三层网关）。
CMS 开放端点由 `packages\server\src\routes\open-platform\open-cms.ts` 承载并挂载到 `/api/open/v1/cms`；签名规范见 [开放平台](/open-platform/)。

Base：`/api/open/v1/cms`

### Scope

| scope | 能力 |
|---|---|
| `cms:read` | 读取栏目树、已发布内容、增量同步 |
| `cms:write` | 创建/更新内容、提交审核、移入回收站 |
| `cms:publish` | 绕过审核直接发布 |

### 写入授权（fail-closed）

持有 `cms:write` **不等于**能写任意站点。写入前必须在「站点管理 → 操作 → 开放授权」中
为该应用显式授权站点，并可进一步限定栏目白名单；未授权一律 403。与人类侧的
`cms_site_users` / `cms_channel_users` 是同一套 fail-closed 思路。表：`cms_open_app_grants`。

**直接发布需三个条件同时成立**（任一不满足即 403）：

1. 应用持有 `cms:publish` scope
2. 授权行开启「允许直接发布」
3. 站点编辑 →「内容策略」开启「允许开放 API 直接发布」（默认关闭）

默认关闭是有意的：外部写入的内容一律先落草稿走站点审核管道，与「站点导入包统一降级为草稿」
是同一条安全约定。

## 只读端点

### 栏目树

```http
GET /api/open/v1/cms/channels?siteCode=main
```

返回站点启用中的栏目树（含 id/code/name/slug/path/type/children）。`code` 为站内唯一的稳定标识，
建议客户端按它引用栏目而非数值 id。

### 内容查询

```http
GET /api/open/v1/cms/contents?siteCode=main&channel=news,notice&sort=-publishedAt&fields=title,coverImage,url
```

| 参数 | 说明 |
|---|---|
| `channel` | 栏目标识，逗号分隔多选（聚合主栏目与副栏目，与前台栏目页一致） |
| `channelPath` | 栏目路径前缀，**含全部子栏目** |
| `tag` | 标签 slug，逗号分隔多选 |
| `contentType` | `article` / `album` / `media` / `link`，逗号分隔多选 |
| `keyword` | 全文检索（与站内搜索共用同一分词与 tsquery 构造，结果集一致） |
| `author` / `model` | 作者精确匹配 / 内容模型标识 |
| `isTop` `isRecommend` `isHot` `isOriginal` | 布尔筛选（`true`/`false`/`1`/`0`） |
| `publishedFrom` / `publishedTo` | 发布时间区间（`YYYY-MM-DD HH:mm:ss`） |
| `extend.{字段}` | 扩展字段过滤，**仅限模型中标记「纳入检索」的字段** |
| `sort` | `-publishedAt,-topWeight`，前缀 `-` 为倒序 |
| `fields` | 字段裁剪，逗号分隔；`id` 始终返回 |
| `include` | `tags,channel,relations,attachments,body,extend` |
| `page` / `pageSize` | 页码分页，`pageSize` 上限 100 |

**白名单 fail-closed**：`sort` / `fields` / `include` / `contentType` 传入白名单之外的取值直接返回 400，
而不是静默忽略 —— 静默忽略会让调用方误以为过滤生效、拿到比预期更宽的数据集。
`extend.*` 额外要求字段在内容模型中标记为可检索，避免外部应用通过 JSONB 路径探测未公开字段。

只返回**已发布、未回收、未归档、且所属栏目处于启用状态**的内容。栏目停用等同前台下线：
不带 `channel` 参数的站级 feed 与显式指定该栏目的结果保持一致，不会出现「站级能拉到、指定栏目 404」。

### 游标翻页（大数据量拉取）

```http
GET /api/open/v1/cms/contents/cursor?siteCode=main&pageSize=100
→ { list: [...], hasMore: true, nextCursor: "MTc2..." }

GET /api/open/v1/cms/contents/cursor?siteCode=main&pageSize=100&cursor=MTc2...
```

keyset 推进，深翻不退化为大 offset，期间新增内容也不会让结果错行或漏行。过滤参数与上面一致。

`sort` 在游标模式下**只允许单个字段**（多字段返回 400）：keyset 条件按「排序值 + id」推进，
多字段排序无法用一个游标准确表达边界，静默降级会漏行。需要多字段排序请改用 `page` 分页。

### 增量同步

```http
GET /api/open/v1/cms/contents/sync?siteCode=main&since=2026-07-01 00:00:00
```

```json
{
  "changes": [
    { "op": "upsert", "id": 12, "updatedAt": "2026-07-02 10:00:00", "content": { "id": 12, "title": "…" } },
    { "op": "delete", "id": 9,  "updatedAt": "2026-07-02 11:20:00" }
  ],
  "hasMore": true,
  "nextCursor": "MTc2…"
}
```

按 `updated_at` keyset 输出变更集，客户端只需持有上次的 `nextCursor` 即可续拉，不必全量重拉。

- `upsert`：当前公开可见的内容
- `delete`：不再公开（下线/回收/归档/**所属栏目被停用**）**或已被彻底删除**

彻底删除的行已不在 `cms_contents` 中，靠墓碑表 `cms_content_tombstones` 补齐 —— 否则客户端
按游标永远拉不到这条变更，本地缓存会残留已删内容。`pageSize` 上限 200。

### 内容详情

```http
GET /api/open/v1/cms/contents/{idOrSlug}?siteCode=main
```

支持 id 或 slug。默认返回正文、扩展字段、标签、附件与栏目信息（无需显式 include）；
映射型内容的正文透传来源内容，与前台详情页共用同一解析函数。

## 写入端点

| 方法 | 路径 | scope | 说明 |
|---|---|---|---|
| `POST` | `/cms/contents` | `cms:write` | 创建内容，默认落草稿并提交审核；`publish: true` 且三重开关全开时直接发布 |
| `PATCH` | `/cms/contents/{id}` | `cms:write` | 更新；带 `expectedVersion` 时版本不符返回 409 |
| `POST` | `/cms/contents/{id}/submit` | `cms:write` | 提交审核 |
| `POST` | `/cms/contents/{id}/publish` | `cms:publish` | 直接发布 |
| `DELETE` | `/cms/contents/{id}` | `cms:write` | 移入回收站（彻底删除仅限后台） |

写入复用后台既有的 `createCmsContent` / `updateCmsContent` 管线，因此**版本快照、操作日志、
发布 outbox、静态产物、敏感词替换、编辑锁校验、素材句柄归一化与引用索引**全部自动生效，
开放 API 不另起一套写路径。

- 幂等：创建接口挂 `idempotencyGuard`，可用 `X-Idempotency-Key` 显式控制
- 来源标记：内容 `source` 记为 `开放应用: {AppKey}`，后台内容列表可据此筛出外部稿件
- 越权栏目 / 跨站内容一律 404，不泄露存在性

## Webhook 事件外推

CMS 事件接入开放平台既有的 Webhook 投递管线（`app_webhook_subscriptions` + `app_webhook_deliveries`），
因此自带 **HMAC 签名、`eventId` 去重、指数退避重试、连续失败自动禁用、投递日志与手工重投**。

| 事件 | 触发时机 |
|---|---|
| `cms.content.published` | 手动发布 / 工作流通过 / 定时发布 |
| `cms.content.updated` | 内容更新 |
| `cms.content.offline` | 手动下线 / 过期自动下线 |
| `cms.content.recycled` | 移入回收站 |
| `cms.content.deleted` | 彻底删除 |

### 可靠性

事件在**业务事务内**登记为任务中心 outbox（`cms-webhook-emit`），worker 取出后再 emit 到事件总线：
事务提交即代表事件不会丢，worker 崩溃由任务中心的 pending 恢复扫描补投。

### 投递范围

CMS 事件是**站点域**事件（无 clientId），只投递给「订阅了该事件类型**且已被授权该站点**」的应用 ——
授权表是唯一的可见性来源，未授权应用即便订阅了事件类型也收不到，避免通过 Webhook 侧信道
泄露其他站点的内容变更。订阅还可用 `cmsSiteId` 进一步收窄到单站点。

### 站点级 Webhook

站点设置里的「Webhook」配置底层托管为一条 `internal` 订阅（`clientId` 形如 `cms-site:{siteId}`，不对应真实开放应用），因此站点级回调同样享有重试、投递日志与自动禁用。事件清单、信封结构与签名头细节见 [SEO 与流量 → Webhook 事件外推](./seo#webhook-事件外推)。

## 错误约定

| code | 说明 |
|---|---|
| 400 | 查询 DSL 参数不合法（白名单外的 sort/fields/include、非法游标、不可用的扩展字段） |
| 401 | AppKey 无效或签名校验失败 |
| 403 | 未授权 scope，或应用未被授权该站点/栏目，或直接发布三重开关未全开 |
| 404 | 站点/栏目/标签/内容不存在或未发布 |
| 409 | `expectedVersion` 与当前版本不一致 |
| 429 | 触发限流套餐配额或幂等窗口 |

## 相关能力

- **草稿预览链接**：后台签发的 HMAC 签名临时 URL（2h 有效），见 [内容管线](./content-pipeline#草稿预览链接)
- 前台公开接口（无需签名）：评论提交/点赞、表单提交、浏览计数 beacon、广告令牌/曝光/点击中转，均带 IP 限流、幂等或去重防刷；评论和表单提交还接入规则中心名单守卫（黑名单 403、灰名单观察标注）
