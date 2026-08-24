import type { AiReasoningLevel } from './constants';

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

/**
 * 模型调用设置（Mastra ModelSettings 子集,调用时透传）。
 * 分层覆盖:降级链条目 > 调用时 > 配置默认。
 */
export interface AiModelSettings {
  /** 采样温度 0-2 */
  temperature?: number;
  /** 单次回复最大输出 token */
  maxOutputTokens?: number;
  /** 核采样 0-1 */
  topP?: number;
  /** 频率惩罚 -2~2 */
  frequencyPenalty?: number;
  /** 存在惩罚 -2~2 */
  presencePenalty?: number;
  /** 推理力度（仅支持 reasoning 的模型生效） */
  reasoning?: AiReasoningLevel;
}

/** 降级链条目:引用另一个服务商配置下的某个模型（Mastra ModelWithRetries 的持久化形态） */
export interface AiModelFallbackRef {
  /** 目标服务商配置 ID */
  configId: number;
  /** 目标模型 ID（裸模型名,不含 provider 前缀） */
  model: string;
  /** 该级重试次数,默认 1 */
  maxRetries?: number;
}

export interface AiProviderConfig {
  id: number;
  name: string;
  /** Mastra 模型目录 provider ID（'openai' / 'anthropic' / ...）或 'custom'（OpenAI 兼容自定义端点） */
  providerId: string;
  /** API 地址:custom 必填;目录服务商留空走官方端点,填写则覆盖 */
  baseUrl: string | null;
  apiKey: string;
  /** 自定义请求头（组织 ID 等） */
  headers: Record<string, string> | null;
  /** 启用的模型列表（裸模型 ID,聊天时可切换） */
  models: string[];
  /** 默认模型（必须包含在 models 中） */
  defaultModel: string;
  /** 模型调用默认设置 */
  modelSettings: AiModelSettings | null;
  /** 服务商特定选项（如 openai.reasoningEffort,按 provider 分组透传） */
  providerOptions: Record<string, Record<string, unknown>> | null;
  /** 多级降级链:主模型失败（5xx/限流/超时）后按序切换 */
  fallbacks: AiModelFallbackRef[] | null;
  /** 模型能力标签（custom 服务商手工标注;目录服务商可由 Mastra 能力数据补充） */
  capabilities: AiModelCapabilities | null;
  /** 输入单价（分 / 百万 token），null = 未配置不计成本 */
  priceInputPerM: number | null;
  /** 输出单价（分 / 百万 token），null = 未配置不计成本 */
  priceOutputPerM: number | null;
  isDefault: boolean;
  isEnabled: boolean;
  /** 并发流上限（null/0 = 不限） */
  maxConcurrent: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 聊天模型选择器条目（/api/ai/models 轻量列表，不含敏感字段）；一个配置可展开多个模型条目 */
export interface AiChatModel {
  /** 服务商配置 ID */
  id: number;
  name: string;
  model: string;
  /** Mastra provider ID 或 'custom' */
  providerId: string;
  isDefault: boolean;
  capabilities: AiModelCapabilities | null;
}

/** 服务商目录条目（GET /api/ai/providers/catalog,来自 Mastra PROVIDER_REGISTRY） */
export interface AiProviderCatalogEntry {
  /** Mastra provider ID */
  id: string;
  /** 显示名 */
  name: string;
  /** 官方文档链接 */
  docUrl: string | null;
  /** 是否常用服务商（AI_COMMON_PROVIDERS 内） */
  common: boolean;
  /** 目录内可用模型数量（模型清单经 /catalog/{providerId}/models 获取） */
  modelCount: number;
}

/** 用户级 AI 设置（单份文档，分域；DB 稀疏存储，读取时与 AI_USER_SETTINGS_DEFAULTS 深合并） */
export interface AiUserSettings {
  /** 个人指令（Custom Instructions） */
  instructions: {
    enabled: boolean;
    /** 关于我：背景、身份、偏好等 */
    aboutMe: string | null;
    /** 回答风格要求 */
    replyStyle: string | null;
  };
  /** AI 记忆（Mastra working memory 用户画像） */
  memory: {
    enabled: boolean;
  };
}

/** 深度可选形态（写入与存储用） */
export type AiUserSettingsPatch = {
  [K in keyof AiUserSettings]?: Partial<AiUserSettings[K]>;
};

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

/** 知识库文档分块（回看原文） */
export interface AiKbChunk {
  id: number;
  content: string;
  tokenCount: number;
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
  providerSnapshot: { providerId: string; model: string; configId?: number } | null;
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
  /** 用户消息附带的图片（managed file id 数组，经 /api/files/{id}/content 访问） */
  images: string[] | null;
  createdAt: string;
}

export type AiFeedbackStatus = 'pending' | 'resolved' | 'ignored';

// ─── P3：自定义智能体 ─────────────────────────────────────────────────────────

/** 自定义智能体(Mastra AgentConfig 形状;创建即用,builtin=编程式内置智能体只读) */
export interface AiAgent {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  avatar: string;
  /** Agent 指令(Mastra instructions) */
  instructions: string;
  /** 指定服务商配置（null = 系统默认） */
  configId: number | null;
  /** 指定模型（null = 配置默认） */
  model: string | null;
  /** 模型调用设置(Mastra ModelSettings 子集) */
  modelSettings: AiModelSettings | null;
  /** 工具循环最大步数(null = 系统默认) */
  maxSteps: number | null;
  knowledgeBaseId: number | null;
  /** 启用的工具名集合 */
  tools: string[];
  openingMessage: string | null;
  suggestedQuestions: string[];
  usageCount: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 编程式内置智能体(代码定义、注册进 Mastra;列表只读展示,可直接对话) */
export interface AiBuiltinAgent {
  /** Mastra agent ID(如 biz-ops-assistant) */
  agentId: string;
  name: string;
  description: string | null;
  avatar: string;
  openingMessage: string | null;
  suggestedQuestions: string[];
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

// ─── P3：评测(Mastra Datasets + Experiments) ─────────────────────────────────

/** 评测数据集(Mastra dataset 包装视图) */
export interface AiEvalDataset {
  /** Mastra dataset ID(UUID) */
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  /** 当前版本号(每次条目变更递增,可回放) */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** 数据集条目:input 为提问文本,groundTruth 为期望要点(可选) */
export interface AiEvalDatasetItem {
  id: string;
  input: string;
  groundTruth: string | null;
}

/** 实验(评测运行):对数据集全量条目执行注册的目标智能体并打分 */
export interface AiEvalExperiment {
  id: string;
  name: string;
  datasetId: string;
  /** 目标 Mastra agent ID(agent-{id} / zenith-chat / 内置智能体) */
  targetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalCount: number;
  succeededCount: number;
  failedCount: number;
  /** 各 scorer 平均分(0-1) */
  avgScores: Record<string, number> | null;
  createdAt: string;
}

/** 实验单条结果 */
export interface AiEvalExperimentResult {
  itemId: string;
  input: string;
  groundTruth: string | null;
  output: string;
  scores: Record<string, number>;
  /** LLM 评审理由(按 scorerId,code 类打分器无理由) */
  reasons: Record<string, string>;
  error: string | null;
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
