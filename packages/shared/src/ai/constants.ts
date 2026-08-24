/**
 * 自定义 OpenAI 兼容端点的 provider ID。
 * 走 Mastra OpenAICompatibleConfig `{ id: 'custom/<model>', url, apiKey }` 直连,
 * 适配私有网关、本地模型(Ollama / LMStudio)与任何未收录进目录的兼容服务。
 */
export const AI_CUSTOM_PROVIDER_ID = 'custom';

/**
 * 常用模型服务商(Mastra 模型目录 provider ID)。
 * 仅作为前端选择器的快捷分组;完整目录(178+ 家)由 `GET /api/ai/providers/catalog`
 * 从 Mastra PROVIDER_REGISTRY 动态提供,后续集成更多服务商无需改代码。
 * id 必须与 Mastra 目录一致(见 @mastra/core/llm 的 getRegisteredProviders())。
 */
export const AI_COMMON_PROVIDERS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google Gemini' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'alibaba', label: '阿里云百炼(通义)' },
  { id: 'moonshotai', label: '月之暗面 Kimi' },
  { id: 'zhipuai', label: '智谱 GLM' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'siliconflow', label: '硅基流动' },
  { id: 'xai', label: 'xAI Grok' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'groq', label: 'Groq' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: AI_CUSTOM_PROVIDER_ID, label: '自定义(OpenAI 兼容)' },
];

/** 推理力度档位(Mastra ReasoningLevel,仅支持 reasoning 的模型生效) */
export const AI_REASONING_LEVELS = ['provider-default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;

export type AiReasoningLevel = (typeof AI_REASONING_LEVELS)[number];

/** 用户级 AI 设置默认值(DB 稀疏存储,读取时深合并;新增域只需扩展此处与 schema) */
export const AI_USER_SETTINGS_DEFAULTS = {
  instructions: { enabled: true, aboutMe: null, replyStyle: null },
  memory: { enabled: true },
} as const;

/**
 * 评测打分器目录(id 与 Mastra 注册表一致):
 * - code 类:纯算法,零 LLM 成本
 * - llm 类:LLM-as-judge,评审模型 = 系统默认服务商配置,每条消耗 token 并产出评审理由
 */
export const AI_EVAL_SCORERS = [
  { id: 'ground-truth',             kind: 'code', label: '期望答案重合度', description: '输出与期望答案的词面重合度(免费)', needsGroundTruth: true,  inverted: false },
  { id: 'completeness-scorer',      kind: 'code', label: '要素完整度',     description: '输出对问题要素的覆盖完整度(免费)', needsGroundTruth: false, inverted: false },
  { id: 'keyword-coverage-scorer',  kind: 'code', label: '关键词覆盖',     description: '问题关键词在输出中的覆盖率(免费)', needsGroundTruth: false, inverted: false },
  { id: 'answer-similarity-scorer', kind: 'llm',  label: '语义一致性',     description: '输出与期望答案的语义一致性(LLM 评审)', needsGroundTruth: true,  inverted: false },
  { id: 'answer-relevancy-scorer',  kind: 'llm',  label: '答案相关性',     description: '是否答非所问(LLM 评审)', needsGroundTruth: false, inverted: false },
  { id: 'toxicity-scorer',          kind: 'llm',  label: '毒性检测',       description: '输出的毒性程度,0=无毒(LLM 评审)', needsGroundTruth: false, inverted: true },
  { id: 'bias-scorer',              kind: 'llm',  label: '偏见检测',       description: '输出的偏见程度,0=无偏见(LLM 评审)', needsGroundTruth: false, inverted: true },
] as const;

export type AiEvalScorerId = (typeof AI_EVAL_SCORERS)[number]['id'];

export const AI_EVAL_SCORER_IDS = AI_EVAL_SCORERS.map((s) => s.id) as [AiEvalScorerId, ...AiEvalScorerId[]];
