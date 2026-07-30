import type { MpConditionalMenu } from '@zenith/shared/mp';
import { SEED_MP_CONDITIONAL_MENUS } from '@zenith/shared/seed';
import { mockDateTime } from '@/mocks/utils/date';

export const mockMpConditionalMenus: MpConditionalMenu[] = SEED_MP_CONDITIONAL_MENUS.map((m) => ({
  id: m.id,
  accountId: m.accountId,
  name: m.name,
  buttons: m.buttons,
  matchRule: m.matchRule,
  menuId: null,
  status: m.status,
  publishedAt: null,
  createdAt: mockDateTime(),
  updatedAt: mockDateTime(),
}));

let nextId = Math.max(0, ...mockMpConditionalMenus.map((m) => m.id)) + 1;
export function getNextMpConditionalMenuId() { return nextId++; }
