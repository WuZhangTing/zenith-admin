import type { AiAgentStatus, AiProvider } from './constants';

// ─── AI 对话模块 ──────────────────────────────────────────────────────────────

export type AiMessageRole = 'system' | 'user' | 'assistant';

/** 模型能力标签 */
export interface AiModelCapabilities {
  /** 支持图片理解（vision） */
  vision?: boolean;
  /** 支持函数调用（function calling） */
  tools?: boolean;
  /** 上下文窗口长度（token） */
  contextWindow?: number;
}

export interface AiProviderConfig {
  id: number;
  name: string;
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 附加可选模型列表（同一服务商多模型） */
  models: string[] | null;
  /** 模型能力标签 */
  capabilities: AiModelCapabilities | null;
  systemPrompt: string | null;
  maxTokens: number;
  temperature: string;
  /** 输入单价（分 / 百万 token），null = 未配置不计成本 */
  priceInputPerM: number | null;
  /** 输出单价（分 / 百万 token），null = 未配置不计成本 */
  priceOutputPerM: number | null;
  isDefault: boolean;
  isEnabled: boolean;
  /** 主备切换降级配置 ID */
  fallbackConfigId: number | null;
  /** 并发流上限（null/0 = 不限） */
  maxConcurrent: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 聊天模型选择器条目（/api/ai/models 轻量列表，不含敏感字段）；一个配置可展开多个模型条目 */
export interface AiChatModel {
  id: number;
  name: string;
  model: string;
  provider: AiProvider;
  isDefault: boolean;
  capabilities: AiModelCapabilities | null;
}

/** 用户级 AI 个性化指令（Custom Instructions） */
export interface AiUserPreference {
  aboutMe: string | null;
  replyStyle: string | null;
  isEnabled: boolean;
}

/** 对话分享信息 */
export interface AiConversationShare {
  token: string;
  url: string;
  expiresAt: string | null;
  createdAt: string;
}

/** 知识库 */
export interface AiKnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  embeddingModel: string | null;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

/** 知识库文档 */
export interface AiKbDocument {
  id: number;
  kbId: number;
  name: string;
  /** 网页抓取来源 URL */
  sourceUrl: string | null;
  status: 'ready' | 'processing' | 'failed';
  chunkCount: number;
  charCount: number;
  error: string | null;
  createdAt: string;
}

/** 知识库检索引用（SSE references 事件） */
export interface AiKbReference {
  docName: string;
  content: string;
  score: number;
}

export interface AiConversation {
  id: number;
  userId: number;
  tenantId: number | null;
  title: string;
  providerSnapshot: { provider: string; model: string; configId?: number } | null;
  isArchived: boolean;
  isPinned: boolean;
  systemPromptOverride: string | null;
  /** 挂载的知识库 ID */
  knowledgeBaseId: number | null;
  /** 关联的智能体 ID */
  agentId: number | null;
  /** 用户自定义标签 */
  tags: string[];
  /** 分支树当前激活叶子消息 ID（null = 线性对话） */
  activeLeafMsgId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 生成调用链 trace 步骤 */
export interface AiTraceStep {
  type: 'retrieval' | 'tool_call' | 'llm_round' | 'failover';
  label: string;
  durationMs: number;
  meta?: Record<string, unknown>;
}

export interface AiMessage {
  id: number;
  conversationId: number;
  /** 分支树父消息 ID（null = 根消息） */
  parentId: number | null;
  role: AiMessageRole;
  content: string;
  /** 推理模型的思维链内容（reasoning_content） */
  reasoning: string | null;
  model: string | null;
  tokensInput: number;
  tokensOutput: number;
  /** 首字延迟（毫秒） */
  ttftMs: number | null;
  /** 本次生成总耗时（毫秒） */
  durationMs: number | null;
  /** 1 = 点赞, -1 = 点踩, null = 未反馈 */
  feedback: number | null;
  feedbackReason: string | null;
  feedbackStatus: AiFeedbackStatus | null;
  feedbackRemark: string | null;
  feedbackHandledAt: string | null;
  /** 生成调用链 trace（assistant 消息） */
  trace: AiTraceStep[] | null;
  createdAt: string;
}

export type AiFeedbackStatus = 'pending' | 'resolved' | 'ignored';

// ─── P3：自定义智能体 ─────────────────────────────────────────────────────────

export interface AiAgent {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  avatar: string;
  systemPrompt: string;
  /** 指定服务商配置（null = 系统默认） */
  configId: number | null;
  /** 指定模型（null = 配置默认） */
  model: string | null;
  temperature: string | null;
  knowledgeBaseId: number | null;
  /** 启用的工具名集合 */
  tools: string[];
  openingMessage: string | null;
  suggestedQuestions: string[];
  status: AiAgentStatus;
  clonedFromId: number | null;
  usageCount: number;
  isEnabled: boolean;
  /** 市场展示：创建者名称 */
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── P3：HTTP API 工具 ────────────────────────────────────────────────────────

export interface AiHttpToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  location: 'query' | 'body' | 'path';
}

export interface AiHttpTool {
  id: number;
  name: string;
  description: string;
  method: string;
  urlTemplate: string;
  headers: Record<string, string> | null;
  params: AiHttpToolParam[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 工具选择器条目（内置 + HTTP 工具统一视图） */
export interface AiToolInfo {
  name: string;
  description: string;
  source: 'builtin' | 'http';
}

// ─── P3：提示词模板版本 ───────────────────────────────────────────────────────

export interface AiPromptTemplateVersion {
  id: number;
  templateId: number;
  version: number;
  name: string;
  content: string;
  createdBy: number | null;
  creatorName: string | null;
  createdAt: string;
}

// ─── P3：评测集 ───────────────────────────────────────────────────────────────

export interface AiEvalItem {
  question: string;
  expected?: string;
}

export interface AiEvalSet {
  id: number;
  name: string;
  description: string | null;
  items: AiEvalItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AiEvalResult {
  question: string;
  expected?: string;
  answer: string;
  durationMs: number;
  tokensInput: number;
  tokensOutput: number;
  error?: string;
}

export interface AiEvalRun {
  id: number;
  setId: number;
  setName?: string | null;
  configId: number | null;
  model: string;
  status: 'running' | 'done' | 'failed';
  results: AiEvalResult[] | null;
  avgDurationMs: number | null;
  totalTokens: number | null;
  createdAt: string;
}

/** 管理端反馈列表条目：消息 + 反馈人 / 会话 / 前置提问上下文 */
export interface AiFeedbackItem extends AiMessage {
  userId: number | null;
  username: string | null;
  nickname: string | null;
  conversationTitle: string | null;
  /** 该条 AI 回复之前最近一条用户提问 */
  question: string | null;
}

export type AiPromptScope = 'system' | 'user';

export interface AiPromptTemplate {
  id: number;
  name: string;
  content: string;
  description: string | null;
  category: string | null;
  scope: AiPromptScope;
  userId: number | null;
  isBuiltin: boolean;
  sort: number;
  /** 被应用为对话角色的累计次数 */
  usageCount: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
