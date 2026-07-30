import { SEED_API_SCOPES } from '@zenith/shared/seed';
import type { ApiScope } from '@zenith/shared/open-platform';

export const mockApiScopes: ApiScope[] = SEED_API_SCOPES.map((s) => ({ ...s }));
