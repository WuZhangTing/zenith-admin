# 智能体

智能体页面菜单路径为 `/ai/agents`。智能体是「instructions + 模型 + 知识库 + 工具」的组合预设，**创建即注册**为一等 Mastra Agent（注册表 ID `agent-{id}`），无市场与上架审核环节。

---

## 组成字段

| 字段 | 说明 |
| --- | --- |
| `name` / `description` / `avatar` | 基本信息（头像为预设 emoji） |
| `instructions` | 智能体指令（1–8192 字，必填） |
| `configId` / `model` | 绑定的服务商配置与模型（空 = 系统默认） |
| `modelSettings` | temperature / maxOutputTokens / 推理档位等模型参数 |
| `maxSteps` | 工具调用最大步数（1–20） |
| `knowledgeBaseId` | 挂载的知识库 |
| `tools` | 可调用的 HTTP 工具列表 |
| `openingMessage` / `suggestedQuestions` | 开场白与建议问题 |

创建 / 更新 / 停用 / 删除全程与 Mastra 注册表同步；已注册的智能体可作为[模型评测](./eval.md)目标，并可在 [Mastra Studio](./studio.md) 中调试。

## 内置智能体

除用户创建的智能体外，系统支持**编程式内置智能体**（代码注册，前端以只读卡片展示），示例见 `biz-demo` 的演示智能体——演示 zod 工具定义与运行时注册。

## 对话集成

- 聊天输入区选择智能体后，会话按智能体的 instructions / 模型 / 知识库 / 工具执行；
- 空会话展示智能体开场白与建议问题；
- 智能体会话计入 `usageCount` 使用统计。

## 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ai/agents` | 我的智能体列表 |
| `GET` | `/api/ai/agents/builtin` | 内置智能体列表 |
| `GET` | `/api/ai/agents/{id}` | 详情 |
| `POST` | `/api/ai/agents` | 创建（同步注册 Mastra） |
| `PUT` | `/api/ai/agents/{id}` | 更新（同步注册表） |
| `DELETE` | `/api/ai/agents/{id}` | 删除（同步注销） |
