import type { MpKfAccount } from '@zenith/shared/mp';
import { SEED_MP_KF_ACCOUNTS } from '@zenith/shared/seed';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockMpKfAccounts: MpKfAccount[] = SEED_MP_KF_ACCOUNTS.map((k) => ({ ...k }));

let nextId = nextIdFrom(mockMpKfAccounts);
export function getNextMpKfAccountId() {
  return nextId++;
}
