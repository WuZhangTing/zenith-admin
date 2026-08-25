# 模型接入

系统级服务商配置页面菜单路径为 `/ai/providers`。配置形态与 Mastra 模型目录对齐：一个配置 = 一个服务商接入点 + 多个模型 + 可选降级链。

---

## Mastra 模型目录

服务商以目录形态接入（`GET /api/ai/providers/catalog`），支持 178+ 服务商；前端表单提供目录选择器并高亮 14 个常用服务商：

`openai`、`anthropic`、`google`、`deepseek`、`alibaba`、`moonshotai`、`zhipuai`、`minimax`、`siliconflow`、`xai`、`mistral`、`groq`、`openrouter`，以及 **`custom`**（私有 OpenAI 兼容网关，直连自定义 `baseUrl`）。

选定服务商后可从目录（`GET /api/ai/providers/catalog/{providerId}/models`）或服务商 API（`POST /api/ai/providers/fetch-models`）拉取模型清单。

## 配置字段

| 字段 | 说明 |
| --- | --- |
| `name` | 配置名称 |
| `providerId` | 目录服务商 ID（`custom` = 私有网关） |
| `baseUrl` | API 地址（目录服务商可省略，`custom` 必填） |
| `apiKey` | API Key；接口返回脱敏，AES-256-GCM 加密入库 |
| `models` | 模型列表（聊天选择器逐模型展开为独立条目） |
| `defaultModel` | 默认模型 |
| `headers` | 自定义请求头 |
| `modelSettings` | 模型参数：temperature、maxOutputTokens、topP、frequency/presencePenalty、**reasoning 推理档位** |
| `providerOptions` | 按 provider 分组透传的原生参数 |
| `fallbacks` | 降级链（见下文） |
| `capabilities` | 能力标签：`vision` / `tools` / `contextWindow` |
| `priceInputPerM` / `priceOutputPerM` | 输入 / 输出单价，用于用量成本估算 |
| `maxConcurrent` | 并发流上限 |
| `isDefault` / `isEnabled` | 默认 / 启用状态 |

设为默认时自动取消其他配置的默认状态；聊天未指定配置时使用启用的系统默认配置。

## 降级链（fallbacks）

`fallbacks` 为有序数组，每级引用「配置 + 模型」并可独立设置重试次数：

- 主模型请求遇 **5xx / 限流 / 超时**时逐级切换下一级，切换经 SSE `failover` 事件通知前端；
- 模型链由 `buildModelChain` 统一构建，推理档位经兼容层翻译为 `reasoningEffort` / `thinking` 请求字段；
- 聊天、智能体、评测走同一条解析链路。

## 连接测试

`POST /api/ai/providers/test-connection`（需 `ai:provider:edit`）向目标服务商发送轻量对话请求验证连通性。编辑已有配置时，API Key 为空或脱敏值则按配置 ID 读取真实密钥测试。

## 聊天模型列表

`GET /api/ai/models` 返回登录用户可用的轻量模型列表（仅含 `id` / `name` / `model` / `providerId` / `isDefault` / `capabilities`，不暴露密钥与地址）。系统配置逐模型展开为 `{configId}:{model}` 条目，个人配置展开为 `user-{id}:{model}`。

## 个人 AI 配置

用户可在聊天页「我的 AI 配置」维护私有配置（`user_ai_configs`），与系统服务商配置**同构**：`providerId` / `baseUrl` / `apiKey` / `headers` / `models[]` / `defaultModel` / `modelSettings` / `providerOptions` / `capabilities` / `systemPrompt`。

- 表单复用系统服务商的模型区与能力区；
- 解析复用系统同款模型覆盖逻辑，capabilities 判定统一（个人配置的图片上传 / 工具能力与系统配置一致生效）；
- 服务端只允许读取当前登录用户自己的配置；API Key 脱敏返回、提交脱敏值时保留原值。

## 接口一览

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| `GET` | `/api/ai/providers` | 配置列表 | `ai:provider:list` |
| `GET` | `/api/ai/providers/catalog` | 服务商目录 | `ai:provider:list` |
| `GET` | `/api/ai/providers/catalog/{providerId}/models` | 目录模型清单 | `ai:provider:list` |
| `POST` | `/api/ai/providers` | 创建配置 | `ai:provider:create` |
| `PUT` | `/api/ai/providers/{id}` | 更新配置 | `ai:provider:edit` |
| `DELETE` | `/api/ai/providers/{id}` | 删除配置 | `ai:provider:delete` |
| `POST` | `/api/ai/providers/{id}/default` | 设为默认 | `ai:provider:edit` |
| `POST` | `/api/ai/providers/test-connection` | 连接测试 | `ai:provider:edit` |
| `POST` | `/api/ai/providers/fetch-models` | 从服务商 API 拉取模型 | `ai:provider:edit` |
| `GET` | `/api/ai/models` | 聊天模型轻量列表 | 登录用户 |
| `GET/POST/PUT/DELETE` | `/api/ai/user-configs*` | 个人配置 CRUD | 登录用户 |
