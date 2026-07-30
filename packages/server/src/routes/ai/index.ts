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
import aiPreferencesRoutes from './ai-preferences';
import aiPromptTemplatesRoutes from './ai-prompt-templates';
import aiProvidersRoutes from './ai-providers';
import aiPublicRoutes from './ai-public';
import aiUsageRoutes from './ai-usage';
import userAiConfigRoutes from './user-ai-config';

export default defineRouteDomain({
  name: 'ai',
  mounts: () => [
    ['/api/ai/providers', aiProvidersRoutes],
    ['/api/ai/models', aiModelsRoutes],
    ['/api/ai/preferences', aiPreferencesRoutes],
    ['/api/ai/conversations', aiConversationExtrasRoutes],
    ['/api/ai/public', aiPublicRoutes],
    ['/api/ai/knowledge-bases', aiKnowledgeRoutes],
    ['/api/ai/agents', aiAgentsRoutes],
    ['/api/ai/generations', aiGenerationsRoutes],
    ['/api/ai/http-tools', aiHttpToolsRoutes],
    ['/api/ai/eval', aiEvalRoutes],
    ['/api/ai/arena', aiArenaRoutes],
    ['/api/ai/audit', aiAuditRoutes],
    ['/api/ai/conversations', aiConversationsRoutes],
    ['/api/ai/conversations', aiChatRoutes],
    ['/api/ai/user-configs', userAiConfigRoutes],
    ['/api/ai/prompt-templates', aiPromptTemplatesRoutes],
    ['/api/ai/usage', aiUsageRoutes],
  ],
});
