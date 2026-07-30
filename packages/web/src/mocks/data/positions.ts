import type { Position } from '@zenith/shared/identity';
import { SEED_POSITIONS } from '@zenith/shared/seed';

export const mockPositions: Position[] = SEED_POSITIONS.map((p) => ({ ...p }));

let nextPositionId = SEED_POSITIONS.length + 1;
export function getNextPositionId() {
  return nextPositionId++;
}
