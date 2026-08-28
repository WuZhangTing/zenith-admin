import type {
  IotAlarm, IotAlarmRule, IotDevice, IotDeviceEvent, IotDeviceGroup,
  IotProduct, IotProductEvent, IotProductProperty, IotProductService,
} from '../iot/types';
import { SEED_DATE } from './_base';

/**
 * IoT 演示数据：DB seed 与 MSW mock 共用。
 * 设备 SN / 密钥为固定演示值，配合 scripts/simulate-iot-device.ts 可直接跑通接入链路。
 */
export const SEED_IOT_PRODUCTS: IotProduct[] = [
  {
    id: 1,
    name: '温湿度传感器 TH-100',
    description: '演示产品：机房环境监测传感器，每 30 秒上报一次温湿度。',
    validationMode: 'loose',
    status: 'enabled',
    deviceCount: 2,
    propertyCount: 4,
    serviceCount: 2,
    eventCount: 2,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_PRODUCT_PROPERTIES: IotProductProperty[] = [
  {
    id: 1, productId: 1, identifier: 'temperature', name: '温度', dataType: 'number',
    accessMode: 'r', unit: '℃', minValue: -40, maxValue: 85, enumOptions: null,
    featured: true, sort: 1, description: '环境温度', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 2, productId: 1, identifier: 'humidity', name: '湿度', dataType: 'number',
    accessMode: 'r', unit: '%RH', minValue: 0, maxValue: 100, enumOptions: null,
    featured: true, sort: 2, description: '相对湿度', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 3, productId: 1, identifier: 'report_interval', name: '上报间隔', dataType: 'number',
    accessMode: 'rw', unit: 's', minValue: 10, maxValue: 3600, enumOptions: null,
    featured: false, sort: 3, description: '遥测上报间隔（秒），可远程调整', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 4, productId: 1, identifier: 'led_enabled', name: '指示灯', dataType: 'boolean',
    accessMode: 'rw', unit: null, minValue: null, maxValue: null, enumOptions: null,
    featured: false, sort: 4, description: '面板指示灯开关', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_PRODUCT_SERVICES: IotProductService[] = [
  {
    id: 1, productId: 1, identifier: 'reboot', name: '重启设备', params: [], danger: true,
    sort: 1, description: '远程重启，重启期间遥测中断约 30 秒', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 2, productId: 1, identifier: 'calibrate', name: '温度校准',
    params: [
      { identifier: 'offset', name: '温度偏移', dataType: 'number', required: true, unit: '℃', minValue: -5, maxValue: 5 },
    ],
    danger: false, sort: 2, description: '对温度读数施加固定偏移量', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_PRODUCT_EVENTS: IotProductEvent[] = [
  {
    id: 1, productId: 1, identifier: 'high_temperature', name: '高温预警', level: 'warn',
    params: [{ identifier: 'temperature', name: '当前温度', dataType: 'number', unit: '℃' }],
    sort: 1, description: '温度超过设备内置阈值时上报', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 2, productId: 1, identifier: 'sensor_fault', name: '传感器故障', level: 'fault',
    params: [{ identifier: 'code', name: '故障码', dataType: 'string' }],
    sort: 2, description: '探头异常或读数漂移', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_DEVICES: IotDevice[] = [
  {
    id: 1,
    sn: 'SN-DEMO-TH100-0001',
    secret: 'demo0001secret0001demo0001secret0001demo0001sec1',
    productId: 1,
    productName: '温湿度传感器 TH-100',
    name: '机房 A-01 温湿度',
    status: 'enabled',
    online: false,
    firmwareVersion: '1.2.0',
    activatedAt: SEED_DATE,
    lastSeenAt: SEED_DATE,
    reported: { temperature: 24.6, humidity: 48, report_interval: 30, led_enabled: true },
    desired: {},
    groupIds: [1],
    groupNames: ['机房 A 区'],
    remark: '演示设备：A 栋机房 1 层 01 机柜',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: 2,
    sn: 'SN-DEMO-TH100-0002',
    secret: 'demo0002secret0002demo0002secret0002demo0002sec2',
    productId: 1,
    productName: '温湿度传感器 TH-100',
    name: '机房 B-02 温湿度',
    status: 'enabled',
    online: false,
    firmwareVersion: '1.1.3',
    activatedAt: null,
    lastSeenAt: null,
    reported: null,
    desired: {},
    groupIds: [2],
    groupNames: ['机房 B 区'],
    remark: '演示设备：B 栋机房 2 层 02 机柜（未激活）',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_DEVICE_GROUPS: IotDeviceGroup[] = [
  {
    id: 1, name: '机房 A 区', description: 'A 栋机房全部环境传感器',
    deviceCount: 1, deviceIds: [1], createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 2, name: '机房 B 区', description: 'B 栋机房全部环境传感器',
    deviceCount: 1, deviceIds: [2], createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_ALARM_RULES: IotAlarmRule[] = [
  {
    id: 1, name: '机房温度过高', productId: 1, productName: '温湿度传感器 TH-100',
    deviceId: null, deviceName: null, ruleType: 'threshold',
    propertyIdentifier: 'temperature', operator: 'gt', threshold: 35, consecutiveCount: 2,
    offlineMinutes: null, eventIdentifier: null, level: 'critical', notifyUserIds: [1],
    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 2, name: '设备离线告警', productId: 1, productName: '温湿度传感器 TH-100',
    deviceId: null, deviceName: null, ruleType: 'offline',
    propertyIdentifier: null, operator: null, threshold: null, consecutiveCount: 1,
    offlineMinutes: 5, eventIdentifier: null, level: 'warning', notifyUserIds: [1],
    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
  {
    id: 3, name: '传感器故障告警', productId: 1, productName: '温湿度传感器 TH-100',
    deviceId: null, deviceName: null, ruleType: 'event',
    propertyIdentifier: null, operator: null, threshold: null, consecutiveCount: 1,
    offlineMinutes: null, eventIdentifier: 'sensor_fault', level: 'critical', notifyUserIds: [1],
    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_ALARMS: IotAlarm[] = [
  {
    id: 1, ruleId: 1, ruleName: '机房温度过高', deviceId: 1,
    deviceName: '机房 A-01 温湿度', deviceSn: 'SN-DEMO-TH100-0001',
    ruleType: 'threshold', level: 'critical', status: 'resolved',
    message: 'temperature 当前值 36.2 > 35（连续 2 次）',
    context: { value: 36.2, operator: 'gt', threshold: 35, property: 'temperature' },
    firedAt: '2024-01-01 10:00:00', resolvedAt: '2024-01-01 10:30:00', resolvedBy: null,
    createdAt: '2024-01-01 10:00:00',
  },
  {
    id: 2, ruleId: 2, ruleName: '设备离线告警', deviceId: 1,
    deviceName: '机房 A-01 温湿度', deviceSn: 'SN-DEMO-TH100-0001',
    ruleType: 'offline', level: 'warning', status: 'firing',
    message: '设备离线超过 5 分钟（最后在线 2024-01-01 00:00:00）',
    context: { offlineMinutes: 5, lastSeenAt: '2024-01-01 00:00:00' },
    firedAt: '2024-01-01 12:00:00', resolvedAt: null, resolvedBy: null,
    createdAt: '2024-01-01 12:00:00',
  },
];

export const SEED_IOT_DEVICE_EVENTS: IotDeviceEvent[] = [
  { id: 1, deviceId: 1, kind: 'lifecycle', identifier: 'activated', name: '设备激活', level: 'info', payload: null, reportedAt: '2024-01-01 00:00:00' },
  { id: 2, deviceId: 1, kind: 'lifecycle', identifier: 'online', name: '设备上线', level: 'info', payload: null, reportedAt: '2024-01-01 00:00:00' },
  { id: 3, deviceId: 1, kind: 'model', identifier: 'high_temperature', name: '高温预警', level: 'warn', payload: { temperature: 36.2 }, reportedAt: '2024-01-01 10:00:00' },
  { id: 4, deviceId: 1, kind: 'lifecycle', identifier: 'offline', name: '设备离线', level: 'warn', payload: null, reportedAt: '2024-01-01 11:55:00' },
];
