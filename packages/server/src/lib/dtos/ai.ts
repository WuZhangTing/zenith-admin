import { z } from '@hono/zod-openapi';

const CapabilitiesDTO = z
  .object({
    vision: z.boolean().optional(),
    tools: z.boolean().optional(),
    contextWindow: z.number().optional(),
  })
  .nullable()
  .openapi({ description: '模型能力标签' });

const ModelSettingsDTO = z
  .object({
    temperature: z.number().optional(),
    maxOutputTokens: z.number().optional(),
    topP: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    reasoning: z.string().optional(),
  })
  .nullable()
  .openapi({ description: '模型调用默认设置（Mastra ModelSettings 子集）' });

const FallbackRefDTO = z
  .object({
    configId: z.number().openapi({ description: '目标服务商配置 ID' }),
    model: z.string().openapi({ description: '目标模型 ID' }),
    maxRetries: z.number().optional().openapi({ description: '该级重试次数' }),
  })
  .openapi({ description: '降级链条目' });

export const AiProviderConfigDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    name: z.string().openapi({ description: '配置名称' }),
    providerId: z.string().openapi({ description: 'Mastra 模型目录 provider ID 或 custom' }),
    baseUrl: z.string().nullable().openapi({ description: 'API 地址（custom 必填；目录服务商可覆盖官方端点）' }),
    apiKey: z.string().openapi({ description: 'API Key（脱敏）' }),
    headers: z.record(z.string(), z.string()).nullable().openapi({ description: '自定义请求头' }),
    models: z.array(z.string()).openapi({ description: '启用的模型列表' }),
    defaultModel: z.string().openapi({ description: '默认模型' }),
    modelSettings: ModelSettingsDTO,
    providerOptions: z.record(z.string(), z.record(z.string(), z.unknown())).nullable().openapi({ description: '服务商特定选项' }),
    fallbacks: z.array(FallbackRefDTO).nullable().openapi({ description: '多级降级链' }),
    capabilities: CapabilitiesDTO,
    priceInputPerM: z.number().nullable().openapi({ description: '输入单价（分/百万token）' }),
    priceOutputPerM: z.number().nullable().openapi({ description: '输出单价（分/百万token）' }),
    isDefault: z.boolean().openapi({ description: '是否默认' }),
    isEnabled: z.boolean().openapi({ description: '是否启用' }),
    maxConcurrent: z.number().nullable().openapi({ description: '并发流上限（null/0=不限）' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('AiProviderConfig');

export const AiProviderCatalogEntryDTO = z
  .object({
    id: z.string().openapi({ description: 'Mastra provider ID' }),
    name: z.string().openapi({ description: '显示名' }),
    docUrl: z.string().nullable().openapi({ description: '官方文档链接' }),
    common: z.boolean().openapi({ description: '是否常用服务商' }),
    modelCount: z.number().openapi({ description: '目录内模型数量' }),
  })
  .openapi('AiProviderCatalogEntry');

export const AiChatModelDTO = z
  .object({
    id: z.number().openapi({ description: '配置 ID' }),
    name: z.string().openapi({ description: '配置名称' }),
    model: z.string().openapi({ description: '模型名称' }),
    providerId: z.string().openapi({ description: 'Mastra provider ID 或 custom' }),
    isDefault: z.boolean().openapi({ description: '是否默认' }),
    capabilities: CapabilitiesDTO,
  })
  .openapi('AiChatModel');

export const AiUserPreferenceDTO = z
  .object({
    aboutMe: z.string().nullable().openapi({ description: '关于我（背景信息）' }),
    replyStyle: z.string().nullable().openapi({ description: '回答风格要求' }),
    isEnabled: z.boolean().openapi({ description: '是否启用个人指令' }),
  })
  .openapi('AiUserPreference');

export const AiConversationShareDTO = z
  .object({
    token: z.string().openapi({ description: '分享 token' }),
    url: z.string().openapi({ description: '分享页相对路径' }),
    expiresAt: z.string().nullable().openapi({ description: '过期时间，null=永久' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
  })
  .openapi('AiConversationShare');

export const AiSharedConversationDTO = z
  .object({
    title: z.string().openapi({ description: '对话标题' }),
    sharedAt: z.string().openapi({ description: '分享时间' }),
    messages: z.array(
      z.object({
        id: z.number(),
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
        reasoning: z.string().nullable(),
        model: z.string().nullable(),
        createdAt: z.string(),
      }),
    ).openapi({ description: '只读消息列表' }),
  })
  .openapi('AiSharedConversation');

export const AiKnowledgeBaseDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    name: z.string().openapi({ description: '名称' }),
    description: z.string().nullable().openapi({ description: '描述' }),
    userId: z.number().openapi({ description: '归属用户' }),
    embeddingModel: z.string().nullable().openapi({ description: '向量化模型（空=关键词检索）' }),
    documentCount: z.number().openapi({ description: '文档数' }),
    chunkCount: z.number().openapi({ description: '分块数' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('AiKnowledgeBase');

export const AiKbDocumentDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    kbId: z.number().openapi({ description: '知识库 ID' }),
    name: z.string().openapi({ description: '文档名称' }),
    sourceUrl: z.string().nullable().openapi({ description: '网页抓取来源 URL' }),
    status: z.enum(['ready', 'processing', 'failed']).openapi({ description: '处理状态' }),
    chunkCount: z.number().openapi({ description: '分块数' }),
    charCount: z.number().openapi({ description: '字符数' }),
    error: z.string().nullable().openapi({ description: '失败原因' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
  })
  .openapi('AiKbDocument');

export const AiKbChunkDTO = z
  .object({
    id: z.number().openapi({ description: '分块 ID' }),
    content: z.string().openapi({ description: '分块文本' }),
    tokenCount: z.number().openapi({ description: 'token 数' }),
  })
  .openapi('AiKbChunk');

export const AiConversationDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    userId: z.number().openapi({ description: '用户 ID' }),
    tenantId: z.number().nullable().openapi({ description: '租户 ID' }),
    title: z.string().openapi({ description: '对话标题' }),
    providerSnapshot: z
      .object({
        providerId: z.string(),
        model: z.string(),
        configId: z.number().optional(),
      })
      .nullable()
      .openapi({ description: '供应商快照' }),
    isArchived: z.boolean().openapi({ description: '是否归档' }),
    isPinned: z.boolean().openapi({ description: '是否置顶' }),
    systemPromptOverride: z.string().nullable().openapi({ description: '对话级提示词（角色模板）' }),
    knowledgeBaseId: z.number().nullable().openapi({ description: '挂载的知识库 ID' }),
    agentId: z.number().nullable().openapi({ description: '关联的智能体 ID' }),
    tags: z.array(z.string()).openapi({ description: '用户自定义标签' }),
    activeLeafMsgId: z.number().nullable().openapi({ description: '分支树激活叶子消息 ID' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('AiConversation');

export const AiTraceStepDTO = z
  .object({
    type: z.enum(['retrieval', 'tool_call', 'llm_round', 'failover']).openapi({ description: '步骤类型' }),
    label: z.string().openapi({ description: '步骤说明' }),
    durationMs: z.number().openapi({ description: '耗时（毫秒）' }),
    meta: z.record(z.string(), z.unknown()).optional().openapi({ description: '附加信息' }),
  })
  .openapi('AiTraceStep');

export const AiMessageDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    conversationId: z.number().openapi({ description: '对话 ID' }),
    parentId: z.number().nullable().openapi({ description: '分支树父消息 ID' }),
    role: z.enum(['system', 'user', 'assistant']).openapi({ description: '消息角色' }),
    content: z.string().openapi({ description: '消息内容' }),
    reasoning: z.string().nullable().openapi({ description: '推理模型思维链内容' }),
    model: z.string().nullable().openapi({ description: '生成所用模型' }),
    tokensInput: z.number().openapi({ description: '输入 token 数' }),
    tokensOutput: z.number().openapi({ description: '输出 token 数' }),
    ttftMs: z.number().nullable().openapi({ description: '首字延迟（毫秒）' }),
    durationMs: z.number().nullable().openapi({ description: '生成总耗时（毫秒）' }),
    feedback: z.number().nullable().openapi({ description: '用户反馈：1=点赞, -1=点踩, null=未反馈' }),
    feedbackReason: z.string().nullable().openapi({ description: '点踩原因' }),
    feedbackStatus: z.enum(['pending', 'resolved', 'ignored']).nullable().openapi({ description: '反馈处理状态' }),
    feedbackRemark: z.string().nullable().openapi({ description: '处理备注' }),
    feedbackHandledAt: z.string().nullable().openapi({ description: '处理时间' }),
    trace: z.array(AiTraceStepDTO).nullable().openapi({ description: '生成调用链 trace' }),
    images: z.array(z.string()).nullable().openapi({ description: '用户消息附带图片（managed file id，经 /api/files/{id}/content 访问）' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
  })
  .openapi('AiMessage');

export const AiFeedbackItemDTO = AiMessageDTO.extend({
  userId: z.number().nullable().openapi({ description: '反馈用户 ID' }),
  username: z.string().nullable().openapi({ description: '反馈用户名' }),
  nickname: z.string().nullable().openapi({ description: '反馈用户昵称' }),
  conversationTitle: z.string().nullable().openapi({ description: '所属对话标题' }),
  question: z.string().nullable().openapi({ description: '该回复之前最近一条用户提问' }),
}).openapi('AiFeedbackItem');

export const AiFeedbackContextDTO = z
  .object({
    conversationId: z.number().openapi({ description: '对话 ID' }),
    conversationTitle: z.string().nullable().openapi({ description: '对话标题' }),
    targetMsgId: z.number().openapi({ description: '目标消息 ID' }),
    user: z
      .object({
        id: z.number(),
        username: z.string(),
        nickname: z.string().nullable(),
        avatar: z.string().nullable(),
      })
      .nullable()
      .openapi({ description: '会话属主（发送人）' }),
    messages: z.array(AiMessageDTO).openapi({ description: '目标消息前后的上下文消息' }),
  })
  .openapi('AiFeedbackContext');

export const UserAiConfigDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    userId: z.number().openapi({ description: '用户 ID' }),
    name: z.string().nullable().openapi({ description: '配置名称' }),
    providerId: z.string().openapi({ description: 'Mastra provider ID 或 custom' }),
    baseUrl: z.string().nullable().openapi({ description: 'API 地址' }),
    apiKey: z.string().nullable().openapi({ description: 'API Key（脱敏）' }),
    model: z.string().nullable().openapi({ description: '模型名称' }),
    modelSettings: ModelSettingsDTO,
    systemPrompt: z.string().nullable().openapi({ description: '系统提示词' }),
    isEnabled: z.boolean().openapi({ description: '是否启用' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('UserAiConfig');

export const AiPromptTemplateDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    name: z.string().openapi({ description: '模板名称' }),
    content: z.string().openapi({ description: '提示词内容' }),
    description: z.string().nullable().openapi({ description: '描述' }),
    category: z.string().nullable().openapi({ description: '分类' }),
    scope: z.enum(['system', 'user']).openapi({ description: '范围：system=系统级, user=用户私有' }),
    userId: z.number().nullable().openapi({ description: '归属用户 ID（用户私有模板）' }),
    isBuiltin: z.boolean().openapi({ description: '是否内置预设（不可删除）' }),
    sort: z.number().openapi({ description: '排序' }),
    usageCount: z.number().openapi({ description: '被应用为对话角色的累计次数' }),
    isEnabled: z.boolean().openapi({ description: '是否启用' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('AiPromptTemplate');

export const AiUsageStatsDTO = z
  .object({
    overview: z.object({
      totalConversations: z.number().openapi({ description: '对话总数' }),
      totalMessages: z.number().openapi({ description: 'AI 回复消息数' }),
      tokensInput: z.number().openapi({ description: '输入 token 总数' }),
      tokensOutput: z.number().openapi({ description: '输出 token 总数' }),
      totalTokens: z.number().openapi({ description: 'token 总数' }),
      activeUsers: z.number().openapi({ description: '活跃用户数' }),
      totalCostFen: z.number().openapi({ description: '预估成本（分），未配置单价的模型不计入' }),
      avgTtftMs: z.number().nullable().openapi({ description: '平均首字延迟（毫秒）' }),
      successRate: z.number().nullable().openapi({ description: '请求成功率（0-100，无数据为 null）' }),
    }),
    byModel: z.array(
      z.object({
        model: z.string(),
        provider: z.string().nullable(),
        messages: z.number(),
        tokensInput: z.number(),
        tokensOutput: z.number(),
        totalTokens: z.number(),
        avgTtftMs: z.number().nullable(),
        costFen: z.number().nullable(),
      }),
    ).openapi({ description: '按模型聚合' }),
    byUser: z.array(
      z.object({
        userId: z.number(),
        username: z.string(),
        nickname: z.string(),
        conversations: z.number(),
        messages: z.number(),
        totalTokens: z.number(),
      }),
    ).openapi({ description: '按用户聚合（Top 10）' }),
    trend: z.array(
      z.object({
        date: z.string(),
        messages: z.number(),
        totalTokens: z.number(),
      }),
    ).openapi({ description: '按日趋势' }),
  })
  .openapi('AiUsageStats');

// ─── P3：自定义智能体 ─────────────────────────────────────────────────────────

export const AiAgentDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    userId: z.number().openapi({ description: '创建者用户 ID' }),
    name: z.string().openapi({ description: '名称' }),
    description: z.string().nullable().openapi({ description: '描述' }),
    avatar: z.string().openapi({ description: '头像 emoji' }),
    instructions: z.string().openapi({ description: 'Agent 指令(Mastra instructions)' }),
    configId: z.number().nullable().openapi({ description: '指定服务商配置（null=系统默认）' }),
    model: z.string().nullable().openapi({ description: '指定模型（null=配置默认）' }),
    modelSettings: ModelSettingsDTO,
    maxSteps: z.number().nullable().openapi({ description: '工具循环最大步数（null=系统默认）' }),
    knowledgeBaseId: z.number().nullable().openapi({ description: '绑定知识库' }),
    tools: z.array(z.string()).openapi({ description: '启用的工具名集合' }),
    openingMessage: z.string().nullable().openapi({ description: '开场白' }),
    suggestedQuestions: z.array(z.string()).openapi({ description: '建议问题' }),
    usageCount: z.number().openapi({ description: '使用次数' }),
    isEnabled: z.boolean().openapi({ description: '是否启用' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('AiAgent');

export const AiBuiltinAgentDTO = z
  .object({
    agentId: z.string().openapi({ description: 'Mastra agent ID' }),
    name: z.string().openapi({ description: '名称' }),
    description: z.string().nullable().openapi({ description: '描述' }),
    avatar: z.string().openapi({ description: '头像 emoji' }),
    openingMessage: z.string().nullable().openapi({ description: '开场白' }),
    suggestedQuestions: z.array(z.string()).openapi({ description: '建议问题' }),
  })
  .openapi('AiBuiltinAgent');

// ─── P3：HTTP API 工具 ────────────────────────────────────────────────────────

export const AiHttpToolParamDTO = z
  .object({
    name: z.string().openapi({ description: '参数名' }),
    type: z.enum(['string', 'number', 'boolean']).openapi({ description: '参数类型' }),
    description: z.string().openapi({ description: '参数说明' }),
    required: z.boolean().openapi({ description: '是否必填' }),
    location: z.enum(['query', 'body', 'path']).openapi({ description: '参数位置' }),
  })
  .openapi('AiHttpToolParam');

export const AiHttpToolDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    name: z.string().openapi({ description: '工具函数名' }),
    description: z.string().openapi({ description: '工具描述（供 LLM 理解用途）' }),
    method: z.string().openapi({ description: 'HTTP 方法' }),
    urlTemplate: z.string().openapi({ description: 'URL 模板（支持 {param} 占位符）' }),
    headers: z.record(z.string(), z.string()).nullable().openapi({ description: '附加请求头' }),
    params: z.array(AiHttpToolParamDTO).openapi({ description: '参数定义' }),
    isEnabled: z.boolean().openapi({ description: '是否启用' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('AiHttpTool');

export const AiToolInfoDTO = z
  .object({
    name: z.string().openapi({ description: '工具名' }),
    description: z.string().openapi({ description: '工具描述' }),
    source: z.enum(['builtin', 'http']).openapi({ description: '来源' }),
  })
  .openapi('AiToolInfo');

// ─── P3：提示词模板版本 ───────────────────────────────────────────────────────

export const AiPromptTemplateVersionDTO = z
  .object({
    id: z.number().openapi({ description: 'ID' }),
    templateId: z.number().openapi({ description: '模板 ID' }),
    version: z.number().openapi({ description: '版本号' }),
    name: z.string().openapi({ description: '当时的模板名称' }),
    content: z.string().openapi({ description: '当时的模板内容' }),
    createdBy: z.number().nullable().openapi({ description: '操作人 ID' }),
    creatorName: z.string().nullable().openapi({ description: '操作人名称' }),
    createdAt: z.string().openapi({ description: '留档时间' }),
  })
  .openapi('AiPromptTemplateVersion');

// ─── P3：评测(Mastra Datasets + Experiments) ─────────────────────────────────

export const AiEvalDatasetDTO = z
  .object({
    id: z.string().openapi({ description: 'Mastra dataset ID' }),
    name: z.string().openapi({ description: '评测集名称' }),
    description: z.string().nullable().openapi({ description: '描述' }),
    itemCount: z.number().openapi({ description: '条目数' }),
    version: z.number().openapi({ description: '当前版本号' }),
    createdAt: z.string().openapi({ description: '创建时间' }),
    updatedAt: z.string().openapi({ description: '更新时间' }),
  })
  .openapi('AiEvalDataset');

export const AiEvalDatasetItemDTO = z
  .object({
    id: z.string().openapi({ description: '条目 ID' }),
    input: z.string().openapi({ description: '评测问题' }),
    groundTruth: z.string().nullable().openapi({ description: '期望要点' }),
  })
  .openapi('AiEvalDatasetItem');

export const AiEvalExperimentDTO = z
  .object({
    id: z.string().openapi({ description: '实验 ID' }),
    name: z.string().openapi({ description: '实验名' }),
    datasetId: z.string().openapi({ description: '数据集 ID' }),
    targetId: z.string().openapi({ description: '目标 Mastra agent ID' }),
    status: z.enum(['pending', 'running', 'completed', 'failed']).openapi({ description: '状态' }),
    totalCount: z.number().openapi({ description: '条目总数' }),
    succeededCount: z.number().openapi({ description: '成功数' }),
    failedCount: z.number().openapi({ description: '失败数' }),
    avgScores: z.record(z.string(), z.number()).nullable().openapi({ description: '各打分器平均分(0-1)' }),
    createdAt: z.string().openapi({ description: '发起时间' }),
  })
  .openapi('AiEvalExperiment');

export const AiEvalExperimentResultDTO = z
  .object({
    itemId: z.string().openapi({ description: '条目 ID' }),
    input: z.string().openapi({ description: '评测问题' }),
    groundTruth: z.string().nullable().openapi({ description: '期望要点' }),
    output: z.string().openapi({ description: '模型输出' }),
    scores: z.record(z.string(), z.number()).openapi({ description: '各打分器得分(0-1)' }),
    error: z.string().nullable().openapi({ description: '失败原因' }),
  })
  .openapi('AiEvalExperimentResult');
