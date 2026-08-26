import { SEED_DECISION_TABLES } from '@zenith/shared/seed';
import type { RuleDecisionTable, RuleExecution } from '@zenith/shared/rules';
import { mockDateTime } from '@/mocks/utils/date';

export const mockDecisionTables: RuleDecisionTable[] = SEED_DECISION_TABLES.map((t) => ({
  ...t,
  description: t.description ?? null,
  categoryId: null,
  status: 'draft',
  version: 1,
  publishedAt: null,
  dirty: false,
  createdAt: mockDateTime(),
  updatedAt: mockDateTime(),
}));

let seq = mockDecisionTables.length + 1;
export const getNextTableId = () => seq++;

export const mockDecisionVersions: Record<number, Array<{ version: number; name: string; hitPolicy: string; inputs: unknown; outputs: unknown; rules: unknown; settings?: unknown; publishedAt: string }>> = {};
export const mockTestCases: Record<number, Array<{ id: number; tableId: number; name: string; input: Record<string, unknown>; expected: Record<string, unknown>; createdAt: string; updatedAt: string }>> = {};
let caseSeq = 1;
export const getNextCaseId = () => caseSeq++;
export const mockExecutions: RuleExecution[] = [];
let execSeq = 1;
export const getNextExecId = () => execSeq++;
