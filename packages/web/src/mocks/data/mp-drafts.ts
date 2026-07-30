import type { MpDraft } from '@zenith/shared/mp';
import { SEED_MP_DRAFTS } from '@zenith/shared/seed';

export const mockMpDrafts: MpDraft[] = SEED_MP_DRAFTS.map((d) => ({ ...d, articles: JSON.parse(JSON.stringify(d.articles)) }));

let nextId = Math.max(0, ...mockMpDrafts.map((d) => d.id)) + 1;
export function getNextMpDraftId() {
  return nextId++;
}
