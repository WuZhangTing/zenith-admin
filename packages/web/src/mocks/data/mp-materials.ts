import type { MpMaterial } from '@zenith/shared/mp';
import { SEED_MP_MATERIALS } from '@zenith/shared/seed';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockMpMaterials: MpMaterial[] = SEED_MP_MATERIALS.map((m) => ({ ...m }));

let nextId = nextIdFrom(mockMpMaterials);
export function getNextMpMaterialId() {
  return nextId++;
}
