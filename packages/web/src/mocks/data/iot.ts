import {
  SEED_IOT_ALARM_RULES, SEED_IOT_ALARMS, SEED_IOT_DEVICE_EVENTS, SEED_IOT_DEVICE_GROUPS,
  SEED_IOT_DEVICES, SEED_IOT_PRODUCT_EVENTS, SEED_IOT_PRODUCT_PROPERTIES,
  SEED_IOT_PRODUCT_SERVICES, SEED_IOT_PRODUCTS,
} from '@zenith/shared/seed';
import type {
  IotAlarm, IotAlarmRule, IotCommand, IotDevice, IotDeviceEvent, IotDeviceGroup,
  IotDeviceShadow, IotProduct, IotProductEvent, IotProductProperty, IotProductService,
  IotTelemetryPoint,
} from '@zenith/shared/iot';
import { mockDateTime } from '@/mocks/utils/date';
import { nextIdFrom } from '@/mocks/utils/handlers';

export const mockIotProducts: IotProduct[] = SEED_IOT_PRODUCTS.map((p) => ({ ...p }));

export const mockIotProperties: IotProductProperty[] = SEED_IOT_PRODUCT_PROPERTIES.map((p) => ({ ...p }));

export const mockIotServices: IotProductService[] = SEED_IOT_PRODUCT_SERVICES.map((s) => ({ ...s }));

export const mockIotEvents: IotProductEvent[] = SEED_IOT_PRODUCT_EVENTS.map((e) => ({ ...e }));

export const mockIotGroups: IotDeviceGroup[] = SEED_IOT_DEVICE_GROUPS.map((g) => ({ ...g, deviceIds: [...(g.deviceIds ?? [])] }));

export const mockIotDevices: IotDevice[] = SEED_IOT_DEVICES.map((d, i) => ({
  ...d,
  // Demo 模式下 1 号设备呈现在线态
  online: i === 0,
  lastSeenAt: i === 0 ? mockDateTime() : d.lastSeenAt,
}));

export const mockIotShadows: Map<number, IotDeviceShadow> = new Map(SEED_IOT_DEVICES.map((d, i) => [d.id, {
  deviceId: d.id,
  reported: { ...(d.reported ?? {}) },
  reportedAt: d.lastSeenAt,
  desired: { ...(d.desired ?? {}) },
  desiredVersion: 0,
  desiredAt: null,
  online: i === 0,
  updatedAt: mockDateTime(),
}]));

export const mockIotAlarmRules: IotAlarmRule[] = SEED_IOT_ALARM_RULES.map((r) => ({ ...r, notifyUserIds: [...r.notifyUserIds] }));

export const mockIotAlarms: IotAlarm[] = SEED_IOT_ALARMS.map((a) => ({ ...a }));

export const mockIotDeviceEvents: IotDeviceEvent[] = SEED_IOT_DEVICE_EVENTS.map((e) => ({ ...e }));

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
    id: 1, deviceId: 1, service: 'calibrate', params: { offset: 0.5 },
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

let nextModelItemId = Math.max(nextIdFrom(mockIotProperties), nextIdFrom(mockIotServices), nextIdFrom(mockIotEvents));
export function getNextIotModelItemId(): number {
  return nextModelItemId++;
}

let nextGroupId = nextIdFrom(mockIotGroups);
export function getNextIotGroupId(): number {
  return nextGroupId++;
}

let nextAlarmRuleId = nextIdFrom(mockIotAlarmRules);
export function getNextIotAlarmRuleId(): number {
  return nextAlarmRuleId++;
}

let nextDeviceEventId = nextIdFrom(mockIotDeviceEvents);
export function getNextIotDeviceEventId(): number {
  return nextDeviceEventId++;
}

/** 设备行上派生分组冗余字段（列表展示） */
export function withGroupInfo(device: IotDevice): IotDevice {
  const groups = mockIotGroups.filter((g) => (g.deviceIds ?? []).includes(device.id));
  const shadow = mockIotShadows.get(device.id);
  return {
    ...device,
    groupIds: groups.map((g) => g.id),
    groupNames: groups.map((g) => g.name),
    reported: shadow?.reported ?? null,
    desired: shadow?.desired ?? null,
  };
}
