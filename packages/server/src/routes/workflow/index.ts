import { defineRouteDomain } from '../_kit';
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
    ['/api/workflows/definitions', workflowDefinitionsRoutes],
    ['/api/workflows/categories', workflowCategoriesRoutes],
    ['/api/workflows/forms', workflowFormsRoutes],
    ['/api/workflows/event-subscriptions', workflowEventSubscriptionsRoutes],
    ['/api/workflows/trigger-executions', workflowTriggerExecutionsRoutes],
    ['/api/workflows/automations', workflowAutomationsRoutes],
    ['/api/workflows/schedules', workflowSchedulesRoutes],
    ['/api/workflows/data-sources', workflowDataSourcesRoutes],
    ['/api/workflows/connectors', workflowConnectorsRoutes],
    ['/api/workflows/simulation-cases', workflowSimulationCasesRoutes],
    ['/api/workflows/saved-views', workflowSavedViewsRoutes],
    ['/api/workflows/delegations', workflowDelegationsRoutes],
    ['/api/workflows/quick-phrases', workflowQuickPhrasesRoutes],
    ['/api/workflows/templates', workflowTemplatesRoutes],
    ['/api/workflows/health', workflowHealthRoutes],
    ['/api/workflows/engine', workflowEngineRoutes],
    ['/api/public/workflow/external-callback', workflowExternalCallbackRoutes],
    ['/api/public/workflow/trigger-callback', workflowTriggerCallbackRoutes],
    ['/api/workflows', workflowInstancesRoutes],
  ],
});
