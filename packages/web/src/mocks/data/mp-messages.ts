import type { MpMessage } from '@zenith/shared/mp';
import { SEED_MP_MESSAGES } from '@zenith/shared/seed';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockMpMessages: MpMessage[] = SEED_MP_MESSAGES.map((m) => ({ ...m }));

let nextId = nextIdFrom(mockMpMessages);
export function getNextMpMessageId() {
  return nextId++;
}
