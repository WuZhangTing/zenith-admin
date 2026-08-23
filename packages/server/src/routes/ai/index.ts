import { defineRouteDomain } from '../_kit';
import aiAgentsRoutes from './ai-agents';
import aiArenaRoutes from './ai-arena';
import aiAuditRoutes from './ai-audit';
import aiChatRoutes from './ai-chat';
import aiConversationExtrasRoutes from './ai-conversation-extras';
import aiConversationsRoutes from './ai-conversations';
import aiEvalRoutes from './ai-eval';
import aiGenerationsRoutes from './ai-generations';
import aiHttpToolsRoutes from './ai-http-tools';
import aiKnowledgeRoutes from './ai-knowledge';
import aiModelsRoutes from './ai-models';
import aiSettingsRoutes from './ai-settings';
import aiPromptTemplatesRoutes from './ai-prompt-templates';
import aiProvidersRoutes from './ai-providers';
import aiPublicRoutes from './ai-public';
import aiUsageRoutes from './ai-usage';
import userAiConfigRoutes from './user-ai-config';

export default defineRouteDomain({
  name: 'ai',
  mounts: () => [
    ['/api/ai/providers', aiProvidersRoutes, { feature: 'ai' }],
    ['/api/ai/models', aiModelsRoutes, { feature: 'ai' }],
    ['/api/ai/settings', aiSettingsRoutes, { feature: 'ai' }],
    ['/api/ai/conversations', aiConversationExtrasRoutes, { feature: 'ai' }],
    ['/api/ai/public', aiPublicRoutes],
    ['/api/ai/knowledge-bases', aiKnowledgeRoutes, { feature: 'ai' }],
    ['/api/ai/agents', aiAgentsRoutes, { feature: 'ai' }],
    ['/api/ai/generations', aiGenerationsRoutes, { feature: 'ai' }],
    ['/api/ai/http-tools', aiHttpToolsRoutes, { feature: 'ai' }],
    ['/api/ai/eval', aiEvalRoutes, { feature: 'ai' }],
    ['/api/ai/arena', aiArenaRoutes, { feature: 'ai' }],
    ['/api/ai/audit', aiAuditRoutes, { feature: 'ai' }],
    ['/api/ai/conversations', aiConversationsRoutes, { feature: 'ai' }],
    ['/api/ai/conversations', aiChatRoutes, { feature: 'ai' }],
    ['/api/ai/user-configs', userAiConfigRoutes, { feature: 'ai' }],
    ['/api/ai/prompt-templates', aiPromptTemplatesRoutes, { feature: 'ai' }],
    ['/api/ai/usage', aiUsageRoutes, { feature: 'ai' }],
  ],
});
