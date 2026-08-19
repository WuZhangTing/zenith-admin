import { defineRouteDomain } from '../_kit';
import workflowAttachmentsRoutes from './workflow-attachments';
import workflowAutomationsRoutes from './workflow-automations';
import workflowCategoriesRoutes from './workflow-categories';
import workflowConnectorsRoutes from './workflow-connectors';
import workflowDataSourcesRoutes from './workflow-data-sources';
import workflowDefinitionsRoutes from './workflow-definitions';
import workflowDelegationsRoutes from './workflow-delegations';
import workflowEngineRoutes from './workflow-engine';
import workflowEventSubscriptionsRoutes from './workflow-event-subscriptions';
import workflowExternalCallbackRoutes from './workflow-external-callback';
import workflowFormsRoutes from './workflow-forms';
import workflowHealthRoutes from './workflow-health';
import workflowInstancesRoutes from './workflow-instances';
import workflowQuickPhrasesRoutes from './workflow-quick-phrases';
import workflowSavedViewsRoutes from './workflow-saved-views';
import workflowSchedulesRoutes from './workflow-schedules';
import workflowSimulationCasesRoutes from './workflow-simulation-cases';
import workflowTemplatesRoutes from './workflow-templates';
import workflowTriggerCallbackRoutes from './workflow-trigger-callback';
import workflowTriggerExecutionsRoutes from './workflow-trigger-executions';

export default defineRouteDomain({
  name: 'workflow',
  mounts: () => [
    ['/api/workflows/definitions', workflowDefinitionsRoutes, { feature: 'workflow' }],
    ['/api/workflows/categories', workflowCategoriesRoutes, { feature: 'workflow' }],
    ['/api/workflows/forms', workflowFormsRoutes, { feature: 'workflow' }],
    ['/api/workflows/event-subscriptions', workflowEventSubscriptionsRoutes, { feature: 'workflow' }],
    ['/api/workflows/trigger-executions', workflowTriggerExecutionsRoutes, { feature: 'workflow' }],
    ['/api/workflows/automations', workflowAutomationsRoutes, { feature: 'workflow' }],
    ['/api/workflows/schedules', workflowSchedulesRoutes, { feature: 'workflow' }],
    ['/api/workflows/data-sources', workflowDataSourcesRoutes, { feature: 'workflow' }],
    ['/api/workflows/connectors', workflowConnectorsRoutes, { feature: 'workflow' }],
    ['/api/workflows/simulation-cases', workflowSimulationCasesRoutes, { feature: 'workflow' }],
    ['/api/workflows/saved-views', workflowSavedViewsRoutes, { feature: 'workflow' }],
    ['/api/workflows/delegations', workflowDelegationsRoutes, { feature: 'workflow' }],
    ['/api/workflows/quick-phrases', workflowQuickPhrasesRoutes, { feature: 'workflow' }],
    ['/api/workflows/templates', workflowTemplatesRoutes, { feature: 'workflow' }],
    ['/api/workflows/attachments', workflowAttachmentsRoutes, { feature: 'workflow' }],
    ['/api/workflows/health', workflowHealthRoutes, { feature: 'workflow' }],
    ['/api/workflows/engine', workflowEngineRoutes, { feature: 'workflow' }],
    ['/api/public/workflow/external-callback', workflowExternalCallbackRoutes],
    ['/api/public/workflow/trigger-callback', workflowTriggerCallbackRoutes],
    ['/api/workflows', workflowInstancesRoutes, { feature: 'workflow' }],
  ],
});
