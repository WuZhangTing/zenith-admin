# 通知中心

通知中心覆盖邮件、短信、站内信、公告与频道五类能力。后端统一挂载在 `/api` 前缀下，业务表集中在 `packages/server/src/db/schema/messaging.ts`（通知模块）、`announcements.ts`（公告模块）与 `channels.ts`（频道模块）；前端页面集中在「系统设置 → 通知管理」下的各管理页、顶部铃铛入口对应的个人收件箱，以及「消息中心」（`/chat`）中的用户侧频道入口。

---

## 能力总览

| 能力 | 配置 | 模板 | 日志 / 记录 | 实时能力 |
| --- | --- | --- | --- | --- |
| 邮件 | `email_configs` 保存 SMTP 主机、端口、账号、发件人和加密方式 | `email_templates` 维护主题、HTML 内容和变量说明 | `email_send_logs` 记录收件邮箱、主题、内容、状态、错误信息、来源、发送人和发送时间 | 无 WebSocket 推送 |
| 短信 | `sms_configs` 支持多通道，按租户设置默认启用通道 | `sms_templates` 维护厂商模板 ID、签名、内容、变量和适用服务商 | `sms_send_logs` 记录手机号、服务商、内容、状态、业务流水号、错误信息和发送时间 | 无 WebSocket 推送 |
| 站内信 | 无独立通道配置 | `in_app_templates` 维护标题、内容、消息类型和变量 | `in_app_messages` 按收件人落库，支持未读、已读、批量已读、删除、批量删除和管理员视角查询 | 推送 `in-app-message:*` |
| 公告 | 无独立通道配置 | 公告正文直接存储在 `announcements` | `announcement_reads` 记录用户已读状态，`announcement_recipients` 记录定向受众 | 推送 `announcement:*` |
| 频道 | `channels` 区分内置系统号与运营号 | `channel_message_templates` 保存群发模板 | `channel_messages` + `channel_message_targets` 记录群发 / 双向消息与定向已读 | 推送 `channel:*` |

通用枚举：

| 枚举 | 取值 |
| --- | --- |
| 发送状态 `send_status` | `pending`、`success`、`failed` |
| 发送来源 `send_source` | `manual`、`test`、`system`、`api` |
| 短信服务商 `sms_provider` | `aliyun`、`tencent` |
| 站内信类型 `in_app_message_type` | `info`、`success`、`warning`、`error` |

---

## 邮件

### SMTP 配置

邮件配置保存在 `email_configs` 表：

| 字段 | 说明 |
| --- | --- |
| `smtp_host` / `smtp_port` | SMTP 服务器地址与端口，端口默认 `465` |
| `smtp_user` / `smtp_password` | SMTP 登录账号与授权密码 |
| `from_name` / `from_email` | 发件人名称与发件邮箱；`from_email` 为空时使用 `smtp_user` |
| `encryption` | `none`、`ssl`、`tls`；`ssl` 使用 secure 连接，`tls` 设置 `requireTLS` |
| `status` | `enabled`、`disabled` |

`GET /api/email-config` 会在配置不存在时创建一条默认记录，返回数据会隐藏 `smtp_password`。`POST /api/email-config/test` 使用当前 SMTP 配置发送固定主题「【Zenith Admin】邮件配置测试」的测试邮件。

### 邮件模板

邮件模板保存在 `email_templates` 表，核心字段为：

| 字段 | 说明 |
| --- | --- |
| `name` | 模板名称 |
| `code` | 模板编码，全局唯一；格式要求以字母开头，仅包含字母、数字、下划线 |
| `subject` | 邮件主题 |
| `content` | 邮件 HTML 内容 |
| `variables` | 变量说明字符串 |
| `status` | `enabled`、`disabled` |
| `remark` | 备注 |

发送时如果传入 `templateId`，服务端会读取启用模板，使用 `variables` 请求对象替换主题和内容中的 `{{变量名}}` 占位符。模板被禁用时发送接口返回 400。

内置邮件模板变量：

| 模板编码 | 变量 |
| --- | --- |
| `user_welcome` | `nickname`、`appName`、`verifyLink` |
| `user_reset_password` | `nickname`、`resetLink` |
| `system_alert` | `title`、`description` |

### 发送日志与状态追踪

邮件发送记录保存在 `email_send_logs` 表。发送流程先写入 `pending` 记录，再调用 `nodemailer`，最后更新为 `success` 或 `failed`，并写入 `sent_at` 与 `error_msg`。

发送记录支持按主题关键词、收件邮箱、状态、来源筛选，支持 Excel 与 CSV 导出。记录字段包括 `template_id`、`to_email`、`subject`、`content`、`status`、`error_msg`、`source`、`user_id`、`ip`、`sent_at`、`created_at`。

---

## 短信

### 多服务商通道配置

短信通道配置保存在 `sms_configs` 表：

| 字段 | 说明 |
| --- | --- |
| `name` | 配置名称 |
| `provider` | `aliyun` 或 `tencent` |
| `access_key_id` / `access_key_secret` | 服务商访问凭据 |
| `region` | 区域；阿里云默认 `cn-hangzhou`，腾讯云默认 `ap-guangzhou` |
| `sign_name` | 默认短信签名 |
| `is_default` | 是否默认通道；同租户内设置默认时会取消其它默认配置 |
| `status` | `enabled`、`disabled` |
| `remark` | 备注 |

列表接口会对 `accessKeyId` 脱敏，详情接口返回空 `accessKeySecret`；更新时如果不传 `accessKeySecret`，后端保持原值。运行时发送只使用 `isDefault = true` 且 `status = enabled` 的通道，并要求默认通道的 `provider` 与短信模板一致。

服务商实现：

| 服务商 | SDK / 端点 | 参数处理 |
| --- | --- | --- |
| `aliyun` | `@alicloud/dysmsapi20170525`，端点 `dysmsapi.aliyuncs.com` | `templateParam` 使用 `JSON.stringify(variables)` |
| `tencent` | `tencentcloud-sdk-nodejs-sms`，端点 `sms.tencentcloudapi.com` | 手机号默认补 `+86`，`TemplateParamSet` 使用 `Object.values(variables)` |

### 短信模板与变量

短信模板保存在 `sms_templates` 表，字段包括 `name`、`code`、`template_code`、`sign_name`、`content`、`variables`、`provider`、`status`、`remark`。`template_code` 对应服务商侧模板 ID；`sign_name` 为空时使用短信配置的 `sign_name`。

发送接口接收 `templateId`、`phone` 和 `variables`。`variables` 会传给服务商模板参数，同时本地日志内容使用 `{{变量名}}` 占位符渲染。

内置短信模板变量：

| 模板编码 | 服务商 | 变量 |
| --- | --- | --- |
| `login_code` | `aliyun` | `code` |
| `register_code` | `aliyun` | `code` |
| `order_notify` | `aliyun` | `orderId` |

### 发送日志

短信发送记录保存在 `sms_send_logs` 表。字段包括 `config_id`、`template_id`、`provider`、`phone`、`content`、`status`、`error_msg`、`biz_id`、`delivery_status`、`delivered_at`、`source`、`user_id`、`ip`、`sent_at`、`created_at`。

当前发送流程以服务商同步返回结果更新 `status`、`biz_id`、`error_msg` 和 `sent_at`；`delivery_status`、`delivered_at` 字段用于保存送达状态数据。发送记录支持按内容关键词、手机号、服务商、状态、来源筛选。

---

## 站内信

### 站内信模板

站内信模板保存在 `in_app_templates` 表，字段包括 `name`、`code`、`title`、`content`、`type`、`variables`、`status`、`remark`。`type` 使用 `info`、`success`、`warning`、`error` 四种消息类型。

内置站内信模板变量：

| 模板编码 | 类型 | 变量 |
| --- | --- | --- |
| `system_upgrade` | `info` | `time`、`duration` |
| `approval_passed` | `success` | `title` |
| `system_warning` | `warning` | `message` |

发送站内信时可以传入 `templateId` 和 `variables`，服务端会使用 `{{变量名}}` 渲染模板标题和内容；也可以直接传入 `title`、`content` 和 `type`。

### 消息发送与收件箱

站内信收件记录保存在 `in_app_messages` 表：

| 字段 | 说明 |
| --- | --- |
| `template_id` | 来源模板，可为空 |
| `user_id` | 收件人 |
| `title` / `content` | 消息标题与正文 |
| `type` | `info`、`success`、`warning`、`error` |
| `is_read` / `read_at` | 阅读状态与阅读时间 |
| `source` | `manual`、`test`、`system`、`api` |
| `sender_id` | 发送人，可为空 |

个人收件箱接口只返回当前登录用户的消息，支持全部、未读、已读筛选。打开消息详情时前端会调用标记已读接口；用户也可以批量 / 全部标记已读，或删除、批量删除自己的消息（标记已读与删除接口均按当前用户过滤，仅作用于本人消息）。

管理员页面使用 `/api/in-app-messages/admin` 查询全量收件记录，支持按标题关键词、消息类型、阅读状态、收件人、发送人筛选，并可发送站内信、标记任意消息已读、一键将全部消息标记已读或删除任意消息。

### 实时推送

站内信写入、已读、全部已读、删除后会通过 WebSocket 推送：

| 事件 | 触发场景 |
| --- | --- |
| `in-app-message:new` | 新站内信送达 |
| `in-app-message:read` | 单条消息标记已读 |
| `in-app-message:read-all` | 当前用户全部标为已读 |
| `in-app-message:deleted` | 消息被接收人或管理员删除 |

前端 `AdminLayout` 接收 `in-app-message:new` 后刷新顶部铃铛列表，并展示「新消息」通知。

---

## 公告

### 公告数据模型

公告主表为 `announcements`，核心字段如下：

| 字段 | 说明 |
| --- | --- |
| `title` / `content` | 公告标题与正文 |
| `type` | `notice`、`announcement`、`warning` |
| `publish_status` | `draft`、`published`、`recalled`、`scheduled` |
| `priority` | `low`、`medium`、`high` |
| `target_type` | `all` 或 `specific` |
| `publish_time` | 发布时间，接口入参格式为 `YYYY-MM-DD HH:mm:ss` |
| `create_by_id` / `create_by_name` | 创建人 |

受众表为 `announcement_recipients`，字段为 `announcement_id`、`recipient_type`、`recipient_id`，其中 `recipient_type` 支持 `user`、`role`、`dept`。已读表为 `announcement_reads`，字段为 `announcement_id`、`user_id`、`read_at`，并通过 `uniq_announcement_user` 保证同一用户对同一公告只有一条已读记录。

公告附件通过通用 `business_files` 表关联，`business_type` 固定为 `announcement`，`business_id` 为公告 ID。

### 发布、定时与阅读

公告支持草稿、发布、撤回和定时发布。创建或更新为 `published` 时，如果未传 `publishTime`，服务端会写入当前时间；创建或更新为 `scheduled` 时必须提供未来时间。内置定时任务「定时公告自动发布」每 5 分钟执行 `publishScheduledAnnouncements`，发布到期的定时公告。

用户侧只读取 `publish_status = published` 且自己可见的公告。可见性规则：

- `target_type = all`：所有在线用户可见
- `target_type = specific`：合并指定用户、指定角色下用户、指定部门下用户

用户可标记单条公告已读，也可全部标记已读。管理端可查看阅读统计，按已读 / 未读分页列出用户，并返回 `readCount`、`totalCount`。

### 实时推送

公告发布、更新、删除和已读状态变更会通过 WebSocket 推送：

| 事件 | 触发场景 |
| --- | --- |
| `announcement:new` | 公告发布 |
| `announcement:updated` | 已发布公告内容更新 |
| `announcement:deleted` | 公告被删除或批量删除 |
| `announcement:read` | 当前用户将单条公告标记为已读 |
| `announcement:read-all` | 当前用户全部标为已读 |

`target_type = all` 时广播给所有连接；`specific` 时推送给解析后的受众用户集合。前端收到公告事件后触发 `announcement:refresh`，并在新公告到达时展示「新公告」通知。

---

## 频道

频道是「站内公众号」形态的订阅式消息能力，代码在 `packages/server/src/routes/messaging/channels.ts` 与 `src/services/messaging/channel*.service.ts`，数据模型集中在 `packages/server/src/db/schema/channels.ts`。频道分两类：

- **系统号**（`type = system`，`builtin = true`）：种子内置 `system-assistant`（「Zenith 助手」），承载系统级卡片通知——工作流审批待办 / 审批结果卡片、IM 离线通知等都经由 `getSystemChannelId()` 投递到该频道，卡片处理后服务端会更新卡片状态并重新推送。
- **运营号**（`type = business`）：管理员创建的业务频道，支持用户自助发现与订阅、群发运营消息、公众号式菜单、自动回复与人工客服双向会话。

### 数据模型

| 表 | 说明 |
| --- | --- |
| `channels` | 频道主体：`code` 唯一标识、名称、头像、简介、`type`（`system` / `business`）、`builtin`、状态、租户 |
| `channel_subscriptions` | 订阅关系（频道 + 用户联合主键），含 `last_read_at`（广播消息已读水位）与 `is_muted` |
| `channel_messages` | 频道消息：`audience_type`（`broadcast` / `targeted`）、`type`（`text` / `card` / `image` / `news`）、`direction`（`out` 频道→用户 / `in` 用户→频道）、`status`（`sent` / `draft` / `scheduled`）、`scheduled_at`、`retracted_at`、`target_spec`（受众定义快照） |
| `channel_message_targets` | 定向消息收件人明细（消息 + 用户联合主键），按人记录 `read_at` |
| `channel_menus` | 公众号式底部菜单：两级树、`type`（`click` 回复消息 / `view` 跳转链接） |
| `channel_auto_replies` | 自动回复规则：`match_type`（`subscribe` / `keyword` / `default`）、关键词与匹配模式（`exact` / `contains`）、回复内容、命中计数 |
| `channel_conversations` | 客服会话（频道 + 用户联合主键）：状态机 `open` → `processing` → `resolved`、受理客服、标签、满意度评价 |
| `channel_quick_replies` | 客服快捷回复短语，`channel_id` 为空表示全局通用 |
| `channel_message_templates` | 群发消息模板 |

### 订阅与阅读

用户在「消息中心」（`/chat`）中查看已订阅频道，通过「发现频道」弹窗浏览可订阅的启用运营号并订阅 / 退订（内置系统号不可退订）。未读数按两路合并计算：广播消息以订阅记录的 `last_read_at` 为水位，定向消息按 `channel_message_targets.read_at` 逐条统计；进入频道视图后调用已读接口同步两者。

### 群发与生命周期

管理端群发支持完整生命周期：

- **受众**：`mode = all`（广播）或按用户 / 部门 / 角色圈选（定向，落 `channel_message_targets` 明细）；发布前可调用受众预估接口计算触达人数。
- **状态**：`sent` 立即发布、`draft` 草稿、`scheduled` 定时发布。草稿与定时消息可编辑、删除或立即发布；系统任务「频道定时群发」由 Cron 定期调用 `publishDueScheduledMessages` 发布到期消息。
- **撤回**：已发布消息可撤回（置 `retracted_at`），并向在线用户推送 `channel:message-retract` 实时移除。
- **辅助**：群发模板 CRUD、测试发送（仅发给操作者本人）、群发记录查询、订阅者管理（查看 / 添加 / 移除，支持导出）。

### 自动回复与客服工作台

用户可在频道内发消息（写入 `direction = in`）。服务端按以下顺序匹配自动回复：关键词精确匹配优先于包含匹配（同模式按 `sort` 排序），无命中时落到 `default` 兜底规则，命中后累加 `hit_count` 并以频道身份自动回复；`subscribe` 类型规则仅在用户订阅运营号时触发欢迎语。

无论是否命中自动回复，用户来信都会创建或重新激活客服会话（已解决的会话重新打开）。客服工作台面向持有 `channel:cs` 权限的用户：

- 会话列表按状态（`open` / `processing` / `resolved`）筛选，客服回复后会话自动转为 `processing`，可手动标记解决、打标签、指派给其他客服（客服候选人 = 拥有 `channel:cs` 权限的启用用户）。
- 快捷回复短语支持全局与频道两级维护；种子内置欢迎语、稍等、结束语、工作时间四条全局短语。
- 用户可对已解决会话提交满意度评价（评分 + 评语）；绩效接口按客服统计会话量与评分。

### 频道数据看板

`GET /api/channels/dashboard`（权限 `channel:dashboard`）聚合运营号数量、订阅总数、累计 / 今日推送、待处理会话数、触达阅读率、平均响应时长、近 7 日推送与来信趋势、会话状态分布、自动回复命中 Top 与频道订阅 Top5。

### 实时推送

| 事件 | 触发场景 |
| --- | --- |
| `channel:message` | 频道消息发布（广播推给全员，定向推给受众） |
| `channel:message-retract` | 群发消息被撤回 |
| `channel:cs-message` | 客服会话有新消息（用户来信或客服回复的轻量刷新信号） |

---

## 接口一览

### 邮件

| 方法 | 路由 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/email-config` | `system:email-config:view` | 获取 SMTP 配置 |
| `PUT` | `/api/email-config` | `system:email-config:update` | 保存 SMTP 配置 |
| `POST` | `/api/email-config/test` | `system:email-config:update` | 发送 SMTP 配置测试邮件 |
| `GET` | `/api/email-templates` | `system:email-template:list` | 邮件模板列表 |
| `GET` | `/api/email-templates/{id}` | `system:email-template:list` | 邮件模板详情 |
| `POST` | `/api/email-templates` | `system:email-template:create` | 创建邮件模板 |
| `PUT` | `/api/email-templates/{id}` | `system:email-template:update` | 更新邮件模板 |
| `DELETE` | `/api/email-templates/{id}` | `system:email-template:delete` | 删除邮件模板 |
| `GET` | `/api/email-send-logs` | `system:email-send-log:list` | 邮件发送记录列表 |
| `POST` | `/api/email-send-logs/test-send` | `system:email-config:update` | 测试发送邮件并写入发送记录 |
| `DELETE` | `/api/email-send-logs/{id}` | `system:email-send-log:delete` | 删除邮件发送记录 |

### 短信

| 方法 | 路由 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/sms-configs` | `system:sms-config:list` | 短信配置列表 |
| `GET` | `/api/sms-configs/{id}` | `system:sms-config:list` | 短信配置详情 |
| `POST` | `/api/sms-configs` | `system:sms-config:create` | 创建短信配置 |
| `PUT` | `/api/sms-configs/{id}` | `system:sms-config:update` | 更新短信配置 |
| `POST` | `/api/sms-configs/{id}/default` | `system:sms-config:default` | 设为默认短信配置 |
| `DELETE` | `/api/sms-configs/{id}` | `system:sms-config:delete` | 删除短信配置 |
| `GET` | `/api/sms-templates` | `system:sms-template:list` | 短信模板列表 |
| `GET` | `/api/sms-templates/{id}` | `system:sms-template:list` | 短信模板详情 |
| `POST` | `/api/sms-templates` | `system:sms-template:create` | 创建短信模板 |
| `PUT` | `/api/sms-templates/{id}` | `system:sms-template:update` | 更新短信模板 |
| `DELETE` | `/api/sms-templates/{id}` | `system:sms-template:delete` | 删除短信模板 |
| `GET` | `/api/sms-send-logs` | `system:sms-send-log:list` | 短信发送记录列表 |
| `POST` | `/api/sms-send-logs/test-send` | `system:sms-send-log:test` | 测试发送短信并写入发送记录 |
| `DELETE` | `/api/sms-send-logs/{id}` | `system:sms-send-log:delete` | 删除短信发送记录 |

### 站内信

| 方法 | 路由 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/in-app-templates` | `system:in-app-template:list` | 站内信模板列表 |
| `GET` | `/api/in-app-templates/{id}` | `system:in-app-template:list` | 站内信模板详情 |
| `POST` | `/api/in-app-templates` | `system:in-app-template:create` | 创建站内信模板 |
| `PUT` | `/api/in-app-templates/{id}` | `system:in-app-template:update` | 更新站内信模板 |
| `DELETE` | `/api/in-app-templates/{id}` | `system:in-app-template:delete` | 删除站内信模板 |
| `GET` | `/api/in-app-messages` | 登录态 | 我的站内信列表 |
| `GET` | `/api/in-app-messages/unread-count` | 登录态 | 未读站内信数量 |
| `GET` | `/api/in-app-messages/{id}` | 登录态 | 我的站内信详情 |
| `POST` | `/api/in-app-messages/send` | `system:in-app-template:list` | 发送站内信 |
| `POST` | `/api/in-app-messages/{id}/read` | `system:in-app-message:read` | 标记单条站内信已读（仅本人消息） |
| `POST` | `/api/in-app-messages/read-all` | `system:in-app-message:read` | 全部标记已读（仅本人消息） |
| `POST` | `/api/in-app-messages/batch-read` | `system:in-app-message:read` | 批量标记已读（仅本人消息） |
| `DELETE` | `/api/in-app-messages/{id}` | `system:in-app-message:delete` | 删除我的站内信 |
| `DELETE` | `/api/in-app-messages/batch` | `system:in-app-message:delete` | 批量删除我的站内信 |
| `GET` | `/api/in-app-messages/admin` | `system:in-app-message:list` | 管理员视角站内信列表 |
| `POST` | `/api/in-app-messages/admin/{id}/read` | `system:in-app-message:read` | 管理员标记任意站内信已读 |
| `POST` | `/api/in-app-messages/admin/read-all` | `system:in-app-message:read` | 管理员将全部站内信标记已读 |
| `DELETE` | `/api/in-app-messages/admin/{id}` | `system:in-app-message:delete` | 管理员删除任意站内信 |

### 公告

| 方法 | 路由 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/announcements/published` | 登录态 | 最近 20 条已发布公告 |
| `GET` | `/api/announcements/unread-count` | 登录态 | 未读公告数量 |
| `GET` | `/api/announcements/inbox` | 登录态 | 公告收件箱 |
| `POST` | `/api/announcements/{id}/read` | 登录态 | 标记公告已读 |
| `POST` | `/api/announcements/read-all` | 登录态 | 全部公告标记已读 |
| `GET` | `/api/announcements` | `system:announcement:list` | 公告管理列表 |
| `GET` | `/api/announcements/{id}` | `system:announcement:list` | 公告详情 |
| `POST` | `/api/announcements` | `system:announcement:create` | 创建公告 |
| `PUT` | `/api/announcements/{id}` | `system:announcement:update` | 更新公告 |
| `DELETE` | `/api/announcements/{id}` | `system:announcement:delete` | 删除公告 |
| `DELETE` | `/api/announcements/batch` | `system:announcement:delete` | 批量删除公告 |
| `GET` | `/api/announcements/{id}/read-stats` | `system:announcement:list` | 公告阅读统计 |

### 频道

用户侧接口（登录态即可访问）：

| 方法 | 路由 | 说明 |
| --- | --- | --- |
| `GET` | `/api/channels/mine` | 我订阅的频道列表（含未读数） |
| `GET` | `/api/channels/discoverable` | 可发现的启用运营号 |
| `POST` / `DELETE` | `/api/channels/{id}/subscribe` | 订阅 / 退订频道 |
| `GET` | `/api/channels/{id}/messages` | 频道消息记录（广播 + 我的定向 + 双向会话） |
| `POST` | `/api/channels/{id}/read` | 标记频道消息已读 |
| `POST` | `/api/channels/{id}/send` | 向频道发消息（触发自动回复与客服会话） |
| `GET` | `/api/channels/{id}/menus` | 频道公众号菜单 |
| `POST` | `/api/channels/{id}/rate` | 评价已解决的客服会话 |

管理侧接口：

| 方法 | 路由 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/channels/admin` | `channel:channel:list` | 频道管理列表 |
| `POST` | `/api/channels` | `channel:channel:create` | 创建频道 |
| `PUT` | `/api/channels/{id}` | `channel:channel:update` | 更新频道 |
| `DELETE` | `/api/channels/{id}` | `channel:channel:delete` | 删除频道（内置系统号不可删） |
| `GET` | `/api/channels/admin/{id}/subscribers` | `channel:channel:list` | 订阅者列表（支持导出） |
| `POST` / `DELETE` | `/api/channels/admin/{id}/subscribers(/{userId})` | `channel:channel:update` | 添加 / 移除订阅者 |
| `POST` | `/api/channels/{id}/publish` | `channel:message:publish` | 群发消息（立即 / 草稿 / 定时，按受众圈选） |
| `POST` | `/api/channels/audience-estimate` | `channel:message:publish` | 群发受众人数预估 |
| `GET` | `/api/channels/admin/{id}/messages` | `channel:message:publish` | 群发记录 |
| `PUT` / `DELETE` | `/api/channels/admin/messages/{id}` | `channel:message:publish` | 编辑 / 删除草稿与定时消息 |
| `POST` | `/api/channels/admin/messages/{id}/publish` | `channel:message:publish` | 草稿 / 定时消息立即发布 |
| `POST` | `/api/channels/admin/messages/{id}/retract` | `channel:message:publish` | 撤回已发布消息 |
| `GET` / `POST` / `PUT` / `DELETE` | `/api/channels/templates(/{id})` | `channel:message:publish` | 群发模板 CRUD |
| `POST` | `/api/channels/{id}/test-send` | `channel:message:publish` | 测试发送（仅发给本人） |
| `PUT` | `/api/channels/{id}/menus` | `channel:menu:save` | 保存频道菜单 |
| `GET` | `/api/channels/{id}/auto-replies` | `channel:reply:list` | 自动回复规则列表 |
| `POST` / `PUT` | `/api/channels/{id}/auto-replies(/{replyId})` | `channel:reply:save` | 创建 / 更新自动回复 |
| `DELETE` | `/api/channels/{channelId}/auto-replies/{replyId}` | `channel:reply:delete` | 删除自动回复 |
| `GET` | `/api/channels/cs/*` | `channel:cs` | 客服工作台查询（频道 / 客服 / 会话 / 消息 / 绩效 / 快捷回复） |
| `POST` / `PUT` | `/api/channels/cs/{id}/conversations/{userId}/*` | `channel:cs` | 客服回复、指派、解决、打标签 |
| `POST` / `PUT` / `DELETE` | `/api/channels/cs/quick-replies(/{id})` | `channel:cs` | 快捷回复短语维护 |
| `GET` | `/api/channels/dashboard` | `channel:dashboard` | 频道数据看板 |

---

## 前端页面

| 页面 | 路径 | 主要能力 |
| --- | --- | --- |
| 邮件配置 | `/system/email-config` | SMTP 表单、保存配置、发送配置测试邮件 |
| 邮件模板 | `/system/email-templates` | 模板列表、按关键词 / 状态筛选、创建、编辑、删除、启停 |
| 邮件发送记录 | `/system/email-send-logs` | 日志筛选、导出、删除、测试发送弹窗 |
| 短信配置 | `/system/sms-configs` | 多服务商配置、默认通道切换、创建、编辑、删除 |
| 短信模板 | `/system/sms-templates` | 模板列表、按关键词 / 服务商 / 状态筛选、创建、编辑、删除、启停 |
| 短信发送记录 | `/system/sms-send-logs` | 日志筛选、导出、删除、测试发送弹窗 |
| 站内信模板 | `/system/in-app-templates` | 模板列表、按关键词 / 类型 / 状态筛选、创建、编辑、删除、启停 |
| 收件记录 | `/system/in-app-messages` | 管理员视角查询、发送站内信、标记已读、删除 |
| 公告管理 | `/system/announcements` | 公告列表、创建、编辑、发布、撤回、取消定时、删除、批量删除、导出、阅读统计、附件 |
| 频道管理 | `/system/channels` | 频道 CRUD、群发（受众圈选 / 草稿 / 定时 / 撤回 / 模板 / 测试发送）、订阅者管理、公众号菜单、自动回复规则 |
| 客服工作台 | `/system/channel-cs` | 会话列表与状态流转、客服回复、指派、打标签、快捷回复、绩效统计 |
| 频道数据 | `/system/channel-dashboard` | 频道运营指标看板与趋势图表 |
| 公告中心 | `/announcements` | 个人公告收件箱、全部 / 未读 / 已读筛选、查看详情、全部已读 |
| 我的消息 | `/inbox` | 个人站内信收件箱、全部 / 未读 / 已读筛选、查看详情、全部已读、删除 |

用户侧的频道入口在「消息中心」（`/chat`）：左侧列表展示已订阅频道与未读数，支持发现 / 订阅频道、查看频道消息、点击公众号菜单与频道对话（WebSocket 事件 `channel:*` 到达后实时刷新）。

`AdminLayout` 在顶部提供公告和站内信入口：公告使用 `/api/announcements/unread-count`、`/api/announcements/published`，站内信使用 `/api/in-app-messages/unread-count`、`/api/in-app-messages`。WebSocket 事件到达后会刷新徽标与弹层数据。

---

## 相关文档

- [WebSocket 事件清单](../backend/websocket-events.md)
- [定时任务](../backend/cron-jobs.md)
