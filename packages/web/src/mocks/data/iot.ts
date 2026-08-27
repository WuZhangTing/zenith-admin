import { SEED_IOT_DEVICES, SEED_IOT_PRODUCTS } from '@zenith/shared/seed';
import type { IotCommand, IotDevice, IotProduct, IotTelemetryPoint } from '@zenith/shared/iot';
import { mockDateTime } from '@/mocks/utils/date';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockIotProducts: IotProduct[] = SEED_IOT_PRODUCTS.map((p) => ({ ...p }));

export const mockIotDevices: IotDevice[] = SEED_IOT_DEVICES.map((d, i) => ({
  ...d,
  // Demo 模式下 1 号设备呈现在线态
  online: i === 0,
  lastSeenAt: i === 0 ? mockDateTime() : d.lastSeenAt,
}));

/** 近 24h 半小时一点的温湿度演示曲线（仅 1 号设备） */
export function buildMockTelemetry(deviceId: number, days: number): IotTelemetryPoint[] {
  if (deviceId !== 1) return [];
  const stepMinutes = days <= 1 ? 30 : days <= 7 ? 240 : 720;
  const count = Math.min(Math.floor((days * 24 * 60) / stepMinutes), 500);
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(now - (count - 1 - i) * stepMinutes * 60 * 1000);
    const hour = at.getHours() + at.getMinutes() / 60;
    const phase = Math.sin(((hour - 14) / 24) * Math.PI * 2);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: i + 1,
      metrics: {
        temperature: Math.round((24 + phase * 3) * 10) / 10,
        humidity: Math.round(50 - phase * 8),
      },
      reportedAt: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}:00`,
    };
  });
}

export const mockIotCommands: IotCommand[] = [
  {
    id: 1, deviceId: 1, service: 'set_interval', params: { interval: 30 },
    status: 'acked', expireAt: mockDateTime(), sentAt: mockDateTime(), ackedAt: mockDateTime(),
    response: { applied: true }, errorMsg: null, createdAt: mockDateTime(),
  },
  {
    id: 2, deviceId: 1, service: 'reboot', params: null,
    status: 'delivered', expireAt: mockDateTime(), sentAt: mockDateTime(), ackedAt: null,
    response: null, errorMsg: null, createdAt: mockDateTime(),
  },
];

let nextProductId = nextIdFrom(mockIotProducts);
export function getNextIotProductId(): number {
  return nextProductId++;
}

let nextDeviceId = nextIdFrom(mockIotDevices);
export function getNextIotDeviceId(): number {
  return nextDeviceId++;
}

let nextCommandId = nextIdFrom(mockIotCommands);
export function getNextIotCommandId(): number {
  return nextCommandId++;
}
