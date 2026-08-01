import { SEED_WORKFLOW_CONNECTORS } from '@zenith/shared/seed';
import type { WorkflowConnector } from '@zenith/shared/workflow';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockWorkflowConnectors: WorkflowConnector[] = SEED_WORKFLOW_CONNECTORS.map((c) => ({
  ...c,
  description: c.description ?? null,
  config: c.config as Record<string, unknown>,
  hasCredentials: false,
  breakerState: 'closed',
  tenantId: null,
  createdBy: null,
  updatedBy: null,
}));

let idSeq = nextIdFrom(mockWorkflowConnectors);
export const getNextConnectorId = (): number => idSeq++;
