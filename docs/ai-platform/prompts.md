# 提示词模板

提示词模板页面菜单路径为 `/ai/prompts`。模板供对话中一键套用为会话角色（`systemPromptOverride`）。

---

## 模板管理

| 字段 | 说明 |
| --- | --- |
| `name` / `description` / `category` | 基本信息与分类 |
| `content` | 模板内容，支持 `{{变量}}` 占位符 |
| `scope` | `system`（全员可见，需管理权限）/ `user`（个人私有） |
| `isBuiltin` / `sort` / `isEnabled` | 内置标记、排序、启用状态 |
| `usageCount` | 使用次数统计 |

## 变量占位符

模板内容中的 `{{变量名}}` 在对话套用时弹出填充表单，替换后作为会话系统提示词。

## 版本管理

每次修改自动保存版本快照（`ai_prompt_template_versions`），支持查看历史版本与一键恢复。

## 接口一览

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| `GET` | `/api/ai/prompt-templates` | 模板列表 | `ai:prompt:list` |
| `POST` | `/api/ai/prompt-templates` | 创建 | `ai:prompt:create` |
| `PUT` | `/api/ai/prompt-templates/{id}` | 更新 | `ai:prompt:edit` |
| `DELETE` | `/api/ai/prompt-templates/{id}` | 删除 | `ai:prompt:delete` |
| `GET` | `/api/ai/prompt-templates/{id}/versions` | 版本历史 | `ai:prompt:list` |
| `POST` | `/api/ai/prompt-templates/{id}/restore` | 恢复版本 | `ai:prompt:edit` |
