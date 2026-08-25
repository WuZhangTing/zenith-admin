import { SEED_DECISION_FLOWS, SEED_RULE_LISTS, SEED_RULE_LIST_ITEMS, SEED_RULE_SCORECARDS } from '@zenith/shared/seed';
import type { RuleDecisionFlow, RuleList, RuleListItem, RuleScorecard } from '@zenith/shared/rules';
import { mockDateTime } from '@/mocks/utils/date';

export const mockDecisionFlows: RuleDecisionFlow[] = SEED_DECISION_FLOWS.map((f) => ({
  ...f,
  description: f.description ?? null,
  status: 'draft',
  publishedSteps: null,
  version: 1,
  publishedAt: null,
  dirty: false,
  createdAt: mockDateTime(),
  updatedAt: mockDateTime(),
}));

let flowSeq = mockDecisionFlows.length + 1;
export const getNextFlowId = () => flowSeq++;

export const mockRuleLists: RuleList[] = SEED_RULE_LISTS.map((l) => ({
  ...l,
  description: l.description ?? null,
  itemCount: SEED_RULE_LIST_ITEMS.filter((i) => i.listId === l.id).length,
  createdAt: mockDateTime(),
  updatedAt: mockDateTime(),
}));

export const mockRuleListItems: RuleListItem[] = SEED_RULE_LIST_ITEMS.map((i) => ({
  ...i,
  label: i.label ?? null,
  expiresAt: i.expiresAt ?? null,
  remark: i.remark ?? null,
  createdAt: mockDateTime(),
}));

let listSeq = mockRuleLists.length + 1;
export const getNextListId = () => listSeq++;
let itemSeq = mockRuleListItems.length + 1;
export const getNextListItemId = () => itemSeq++;

// ─── 评分卡 ──────────────────────────────────────────────────────────────────────
export const mockRuleScorecards: RuleScorecard[] = SEED_RULE_SCORECARDS.map((s) => ({
  ...s,
  description: s.description ?? null,
  status: 'draft',
  version: 1,
  publishedAt: null,
  dirty: false,
  createdAt: mockDateTime(),
  updatedAt: mockDateTime(),
}));

let scorecardSeq = mockRuleScorecards.length + 1;
export const getNextScorecardId = () => scorecardSeq++;
