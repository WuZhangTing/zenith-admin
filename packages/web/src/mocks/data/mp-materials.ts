import type { MpMaterial } from '@zenith/shared/mp';
import { SEED_MP_MATERIALS } from '@zenith/shared/seed';

export const mockMpMaterials: MpMaterial[] = SEED_MP_MATERIALS.map((m) => ({ ...m }));

let nextId = Math.max(0, ...mockMpMaterials.map((m) => m.id)) + 1;
export function getNextMpMaterialId() {
  return nextId++;
}
