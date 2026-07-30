import type { MpAutoReply } from '@zenith/shared/mp';
import { SEED_MP_AUTO_REPLIES } from '@zenith/shared/seed';

export const mockMpAutoReplies: MpAutoReply[] = SEED_MP_AUTO_REPLIES.map((r) => ({ ...r }));

let nextId = Math.max(0, ...mockMpAutoReplies.map((r) => r.id)) + 1;
export function getNextMpAutoReplyId() {
  return nextId++;
}
