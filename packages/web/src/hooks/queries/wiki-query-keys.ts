import type { WikiGovernanceKind } from '@zenith/shared/wiki';

export const wikiStatsKeys = {
  all: ['wiki-stats'] as const,
  overview: ['wiki-stats', 'overview'] as const,
  hotDocs: ['wiki-stats', 'hot-docs'] as const,
  contributors: ['wiki-stats', 'contributors'] as const,
  staleDocs: ['wiki-stats', 'stale-docs'] as const,
  ops: ['wiki-stats', 'ops'] as const,
};

export const wikiSettingsKey = ['wiki-settings'] as const;

export const wikiGovernanceKeys = {
  all: ['wiki-governance'] as const,
  lists: ['wiki-governance', 'list'] as const,
  list: (kind: WikiGovernanceKind, params: unknown) => ['wiki-governance', 'list', kind, params] as const,
  noResultKeywords: ['wiki-governance', 'no-result-keywords'] as const,
};
