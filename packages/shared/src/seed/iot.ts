import type { IotDevice, IotProduct } from '../iot/types';
import { SEED_DATE } from './_base';

/**
 * IoT 演示数据：DB seed 与 MSW mock 共用。
 * 设备 SN / 密钥为固定演示值，配合 scripts/simulate-iot-device.ts 可直接跑通接入链路。
 */
export const SEED_IOT_PRODUCTS: IotProduct[] = [
  {
    id: 1,
    name: '温湿度传感器 TH-100',
    keyMetrics: ['temperature', 'humidity'],
    description: '演示产品：机房环境监测传感器，每 30 秒上报一次温湿度。',
    status: 'enabled',
    deviceCount: 2,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const SEED_IOT_DEVICES: IotDevice[] = [
  {
    id: 1,
    sn: 'SN-DEMO-TH100-0001',
    secret: 'demo0001secret0001demo0001secret0001demo0001sec1',
    productId: 1,
    productName: '温湿度传感器 TH-100',
    keyMetrics: ['temperature', 'humidity'],
    name: '机房 A-01 温湿度',
    status: 'enabled',
    online: false,
    firmwareVersion: '1.2.0',
    activatedAt: SEED_DATE,
    lastSeenAt: SEED_DATE,
    latestMetrics: { temperature: 24.6, humidity: 48 },
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
    keyMetrics: ['temperature', 'humidity'],
    name: '机房 B-02 温湿度',
    status: 'enabled',
    online: false,
    firmwareVersion: '1.1.3',
    activatedAt: null,
    lastSeenAt: null,
    latestMetrics: null,
    remark: '演示设备：B 栋机房 2 层 02 机柜（未激活）',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];
