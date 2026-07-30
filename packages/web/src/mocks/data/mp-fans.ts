import type { MpFan } from '@zenith/shared/mp';
import { SEED_MP_FANS } from '@zenith/shared/seed';

export const mockMpFans: MpFan[] = SEED_MP_FANS.map((f) => ({ ...f, tagIds: [...f.tagIds] }));
