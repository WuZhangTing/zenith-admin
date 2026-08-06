import { createLabelOptions } from '../core/enum-options';

export const AI_PROVIDER_TYPES = ['openai_compatible', 'anthropic', 'gemini', 'baidu'] as const;

export type AiProvider = (typeof AI_PROVIDER_TYPES)[number];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai_compatible: 'OpenAI Compatible',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  baidu: '百度千帆',
};

export const AI_PROVIDER_OPTIONS: Array<{ value: AiProvider; label: string }> =
  createLabelOptions(AI_PROVIDER_TYPES, AI_PROVIDER_LABELS);

export const AI_AGENT_STATUSES = ['private', 'pending', 'published', 'rejected'] as const;

export type AiAgentStatus = (typeof AI_AGENT_STATUSES)[number];

export const AI_AGENT_STATUS_LABELS: Record<AiAgentStatus, string> = {
  private: '私有',
  pending: '待审核',
  published: '已上架',
  rejected: '已驳回',
};
