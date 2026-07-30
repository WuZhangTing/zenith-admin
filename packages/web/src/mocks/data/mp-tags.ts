import type { MpTag } from '@zenith/shared/mp';
import { SEED_MP_TAGS } from '@zenith/shared/seed';

export const mockMpTags: MpTag[] = SEED_MP_TAGS.map((t) => ({ ...t }));

let nextId = Math.max(0, ...mockMpTags.map((t) => t.id)) + 1;
export function getNextMpTagId() {
  return nextId++;
}
