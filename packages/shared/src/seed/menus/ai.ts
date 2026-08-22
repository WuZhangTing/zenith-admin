import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** 智能助手（3000 段） */
export const SEED_MENUS_AI: Menu[] = [
  { id: 3000, parentId: 0, title: '智能助手', name: 'AiFeatures', icon: 'Sparkles', type: 'directory', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3010, parentId: 3000, title: '智能对话', name: 'AiChat', path: '/ai/chat', component: 'ai/chat/AIChatPage', icon: 'MessageSquare', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3020, parentId: 3000, title: 'AI 服务商', name: 'AiProviders', path: '/ai/providers', component: 'ai/providers/AIProvidersPage', icon: 'Cpu', type: 'menu', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3021, parentId: 3020, title: '查询', type: 'button', permission: 'ai:provider:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3022, parentId: 3020, title: '新增', type: 'button', permission: 'ai:provider:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3023, parentId: 3020, title: '编辑', type: 'button', permission: 'ai:provider:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3024, parentId: 3020, title: '删除', type: 'button', permission: 'ai:provider:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3030, parentId: 3000, title: 'AI 反馈', name: 'AiFeedback', path: '/ai/feedback', component: 'ai/feedback/AiFeedbackPage', icon: 'ThumbsUp', type: 'menu', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3031, parentId: 3030, title: '查询', type: 'button', permission: 'ai:feedback:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3032, parentId: 3030, title: '处理反馈', type: 'button', permission: 'ai:feedback:handle', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3040, parentId: 3000, title: '提示词模板', name: 'AiPromptTemplates', path: '/ai/prompts', component: 'ai/prompts/PromptTemplatesPage', icon: 'BookText', type: 'menu', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3041, parentId: 3040, title: '查询', type: 'button', permission: 'ai:prompt:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3042, parentId: 3040, title: '新增', type: 'button', permission: 'ai:prompt:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3043, parentId: 3040, title: '编辑', type: 'button', permission: 'ai:prompt:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3044, parentId: 3040, title: '删除', type: 'button', permission: 'ai:prompt:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3050, parentId: 3000, title: '用量统计', name: 'AiUsage', path: '/ai/usage', component: 'ai/usage/AiUsagePage', icon: 'BarChart3', type: 'menu', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3051, parentId: 3050, title: '查询', type: 'button', permission: 'ai:usage:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3060, parentId: 3000, title: '对话审计', name: 'AiAudit', path: '/ai/audit', component: 'ai/audit/AiAuditPage', icon: 'ShieldCheck', type: 'menu', sort: 6, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3061, parentId: 3060, title: '查询', type: 'button', permission: 'ai:audit:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3070, parentId: 3000, title: '知识库', name: 'AiKnowledge', path: '/ai/knowledge', component: 'ai/knowledge/AiKnowledgePage', icon: 'Library', type: 'menu', sort: 7, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3071, parentId: 3070, title: '查询', type: 'button', permission: 'ai:kb:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3072, parentId: 3070, title: '新增', type: 'button', permission: 'ai:kb:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3073, parentId: 3070, title: '编辑', type: 'button', permission: 'ai:kb:edit', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3074, parentId: 3070, title: '删除', type: 'button', permission: 'ai:kb:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3080, parentId: 3000, title: '智能体', name: 'AiAgents', path: '/ai/agents', component: 'ai/agents/AiAgentsPage', icon: 'Bot', type: 'menu', sort: 8, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3081, parentId: 3080, title: 'Studio 接入', type: 'button', permission: 'ai:studio:access', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3090, parentId: 3000, title: 'AI 工具', name: 'AiTools', path: '/ai/tools', component: 'ai/tools/AiToolsPage', icon: 'Wrench', type: 'menu', sort: 9, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3091, parentId: 3090, title: '查询', type: 'button', permission: 'ai:tool:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3092, parentId: 3090, title: '管理', type: 'button', permission: 'ai:tool:manage', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3100, parentId: 3000, title: '模型评测', name: 'AiEval', path: '/ai/eval', component: 'ai/eval/AiEvalPage', icon: 'FlaskConical', type: 'menu', sort: 10, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3101, parentId: 3100, title: '查询', type: 'button', permission: 'ai:eval:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3102, parentId: 3100, title: '管理', type: 'button', permission: 'ai:eval:manage', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 工作流引擎（4000 段）
];
