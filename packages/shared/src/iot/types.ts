import type { IotCommandStatus } from './constants';

export type IotMetricValue = number | string | boolean;

export interface IotProduct {
  id: number;
  name: string;
  keyMetrics: string[];
  description: string | null;
  status: 'enabled' | 'disabled';
  /** 关联设备数（列表聚合返回） */
  deviceCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotDevice {
  id: number;
  sn: string;
  /** 接入密钥（管理端可见，用于设备侧签名） */
  secret: string;
  productId: number;
  productName?: string | null;
  /** 产品声明的关键指标（详情图表默认选项） */
  keyMetrics?: string[];
  name: string;
  status: 'enabled' | 'disabled';
  /** 实时在线态（Redis TTL 键，运行态字段） */
  online: boolean;
  firmwareVersion: string | null;
  activatedAt: string | null;
  lastSeenAt: string | null;
  /** 最近一次遥测指标（列表快照展示） */
  latestMetrics?: Record<string, IotMetricValue> | null;
  remark: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotTelemetryPoint {
  id: number;
  metrics: Record<string, IotMetricValue>;
  /** YYYY-MM-DD HH:mm:ss */
  reportedAt: string;
}

export interface IotCommand {
  id: number;
  deviceId: number;
  service: string;
  params: Record<string, unknown> | null;
  status: IotCommandStatus;
  expireAt: string;
  sentAt: string | null;
  ackedAt: string | null;
  response: Record<string, unknown> | null;
  errorMsg: string | null;
  createdBy?: number | null;
  createdAt: string;
}

/** 设备侧指令载荷（WS command:exec 帧 / HTTP 拉取响应） */
export interface IotCommandPayload {
  commandId: number;
  service: string;
  params: Record<string, unknown> | null;
  expireAt: string;
}
