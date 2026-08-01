import type { MpQrcode } from '@zenith/shared/mp';
import { SEED_MP_QRCODES } from '@zenith/shared/seed';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockMpQrcodes: MpQrcode[] = SEED_MP_QRCODES.map((q) => ({ ...q }));

let nextId = nextIdFrom(mockMpQrcodes);
export function getNextMpQrcodeId() {
  return nextId++;
}
