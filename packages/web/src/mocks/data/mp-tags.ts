import type { MpTag } from '@zenith/shared/mp';
import { SEED_MP_TAGS } from '@zenith/shared/seed';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockMpTags: MpTag[] = SEED_MP_TAGS.map((t) => ({ ...t }));

let nextId = nextIdFrom(mockMpTags);
export function getNextMpTagId() {
  return nextId++;
}
