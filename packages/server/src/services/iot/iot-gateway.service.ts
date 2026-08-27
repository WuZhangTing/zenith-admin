/**
 * IoT 设备 WS 网关连接管理（单实例内存注册表）。
 *
 * 连接语义：握手验签通过并 onOpen 注册 = 在线（写 Redis TTL），
 * 断开 = 离线（删 Redis 键；HTTP 心跳设备不受影响，键会被其心跳重建）。
 * 多实例部署时指令需经 Redis pub/sub 路由到持有连接的实例，当前部署形态为单实例，留待需要时演进。
 */
import type { WSContext } from 'hono/ws';
import type { IotCommandPayload } from '@zenith/shared/iot';
import { IOT_WS_FRAME_TYPES } from '@zenith/shared/iot';
import logger from '../../lib/logger';

const connections = new Map<string, WSContext>();

export function registerDeviceConnection(sn: string, ws: WSContext): void {
  // 同 SN 重复连接：踢掉旧连接，保留最新（设备重连场景）
  const existing = connections.get(sn);
  if (existing && existing !== ws) {
    try {
      existing.close(4000, 'Replaced by new connection');
    } catch { /* 旧连接可能已断 */ }
  }
  connections.set(sn, ws);
}

export function removeDeviceConnection(sn: string, ws: WSContext): void {
  // 仅当映射还指向本连接时才移除，避免重连竞态误删新连接
  if (connections.get(sn) === ws) connections.delete(sn);
}

export function isDeviceConnected(sn: string): boolean {
  return connections.has(sn);
}

/** 向设备推送指令帧；返回是否推送成功（未连接/发送异常返回 false，调用方保持 pending） */
export async function pushCommandToDevice(sn: string, payload: IotCommandPayload): Promise<boolean> {
  const ws = connections.get(sn);
  if (!ws) return false;
  try {
    ws.send(JSON.stringify({ type: IOT_WS_FRAME_TYPES.commandExec, payload }));
    return true;
  } catch (err) {
    logger.warn(`[iot-gateway] 指令推送失败 sn=${sn}: ${(err as Error).message}`);
    connections.delete(sn);
    return false;
  }
}

export function getConnectedDeviceCount(): number {
  return connections.size;
}
