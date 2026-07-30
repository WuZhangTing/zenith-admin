import type { MpKfAccount } from '@zenith/shared/mp';
import { SEED_MP_KF_ACCOUNTS } from '@zenith/shared/seed';

export const mockMpKfAccounts: MpKfAccount[] = SEED_MP_KF_ACCOUNTS.map((k) => ({ ...k }));

let nextId = Math.max(0, ...mockMpKfAccounts.map((k) => k.id)) + 1;
export function getNextMpKfAccountId() {
  return nextId++;
}
