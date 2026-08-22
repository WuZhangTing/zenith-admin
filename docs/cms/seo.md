# SEO 与流量

## Social SEO

全部内置主题、动态 SSR、静态页和草稿预览统一输出 `og:url`、`og:site_name`、图片说明、Article 发布时间/修改时间/作者，以及完整 Twitter Card（card/site/creator/title/description/image/image alt）——SEO head 为主题共享组件（`SeoHead`），主题复用该组件即可获得全套输出。站点配置提供默认 Twitter 账号、Card 类型和图片说明，内容可覆盖作者账号与社交图片说明。

## 三级 TDK 覆盖

SEO 标题/关键词/描述按 **内容 → 栏目 → 站点** 三级向上回退，留空即继承。详情页额外输出 canonical、Open Graph 与 Article JSON-LD 结构化数据。

## SEO 管理页

「SEO 管理」（权限 `cms:seo:manage`）包含四个 Tab：

### 301/302 重定向

站内旧路径 → 新地址映射，前台路由优先级最高。**目标地址仅允许站内路径（`/` 开头）或本系统站点域名的完整 URL**——创建/更新时校验 + 解析时兜底双重防护，杜绝开放重定向被用作钓鱼跳板。

### 内链词

正文关键词自动加链（SEO 内链建设）。仅处理 HTML 文本节点，跳过 `<a>/<script>/<style>` 内部，每词限次替换；URL 经 HTML 属性转义防注入。

### 搜索推送

发布内容后自动向搜索引擎主动推送，此 Tab 也支持手动批量推送历史 URL（`POST /api/cms/seo/push`，权限 `cms:seo:push`）：

- **百度普通收录**：站点配置 `baiduPushToken`
- **IndexNow**（Bing 等）：站点配置 `indexNowKey`，key 校验文件自动托管于 `/{key}.txt`

推送凭证在「站点管理 → 编辑站点 → 搜索推送」中配置，且需绑定站点域名。推送结果（成功/状态码/响应）留痕于 `cms_push_logs`，Tab 内可查推送日志。

### 死链检测

提交任务中心任务（`cms-deadlink-check`，`POST /api/cms/seo/deadlink-check`），扫描已发布内容中的站内/外部链接（经统一 `http-client` 外呼，SSRF 防护），输出死链行级明细。

## sitemap / robots / RSS

- `sitemap.xml`：动态生成（Redis 600s 缓存），含首页/栏目/详情，上限 5 万条
- `robots.txt`：站点级独立配置
- RSS 2.0：站点级 `/rss.xml` 与栏目级 `/{channelPath}/rss.xml`

## Webhook 事件外推

站点设置「Webhook」配置回调地址（可选签名密钥）后，内容变更事件自动 POST 推送到该地址。站点级 Webhook 底层托管为开放平台统一投递管线的一条 `internal` 订阅（`app_webhook_subscriptions` + `app_webhook_deliveries`），因此自带 **HMAC 签名、`eventId` 去重、指数退避重试（1/5/30/180/720 分钟五档）、连续失败自动禁用、投递日志与手工重投**。

| 事件 | 触发时机 |
|------|---------|
| `cms.content.published` | 手动发布 / 工作流通过 / 定时发布 |
| `cms.content.updated` | 内容更新 |
| `cms.content.offline` | 手动下线 / 过期自动下线 |
| `cms.content.recycled` | 移入回收站 |
| `cms.content.deleted` | 彻底删除 |

请求体为统一事件信封：

```json
{
  "type": "cms.content.published",
  "eventId": "8f0d…（UUID）",
  "clientId": null,
  "scope": { "siteId": 1 },
  "occurredAt": "2026-07-20 12:00:00",
  "data": {
    "site": { "id": 1, "code": "main", "name": "主站" },
    "content": { "id": 42, "channelId": 3, "title": "…", "slug": null, "status": "published", "version": 3, "publishedAt": "…" }
  }
}
```

投递请求头携带 `X-Zenith-Event` / `X-Zenith-Event-Id` / `X-Zenith-Delivery-Id` / `X-Zenith-Attempt`；配置签名密钥后附加 `X-Zenith-Signature: t={unix},v1={HMAC-SHA256(secret, "{t}.{body}")}`，接收方验签防伪造。

事件在**业务事务内**先落任务中心 outbox（`cms-webhook-emit`），worker 再发射到事件总线并持久化投递记录——事务提交即保证事件不丢，投递失败按退避阶梯自动重试。可靠性机制与面向开放应用的事件订阅详见 [开放能力（Headless API）](./open-api#webhook-事件外推)。
