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
