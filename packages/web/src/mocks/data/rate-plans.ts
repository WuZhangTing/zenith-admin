import { SEED_RATE_PLANS } from '@zenith/shared/seed';
import type { RatePlan } from '@zenith/shared/open-platform';

export const mockRatePlans: RatePlan[] = SEED_RATE_PLANS.map((p) => ({ ...p }));
