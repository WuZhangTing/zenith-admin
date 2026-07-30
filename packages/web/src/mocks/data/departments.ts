import type { Department } from '@zenith/shared/identity';
import { SEED_DEPARTMENTS } from '@zenith/shared/seed';

export const mockDepartments: Department[] = SEED_DEPARTMENTS.map((d) => ({ ...d }));

let nextDeptId = SEED_DEPARTMENTS.length + 1;
export function getNextDeptId() {
  return nextDeptId++;
}
