import type { MpQrcode } from '@zenith/shared/mp';
import { SEED_MP_QRCODES } from '@zenith/shared/seed';

export const mockMpQrcodes: MpQrcode[] = SEED_MP_QRCODES.map((q) => ({ ...q }));

let nextId = Math.max(0, ...mockMpQrcodes.map((q) => q.id)) + 1;
export function getNextMpQrcodeId() {
  return nextId++;
}
