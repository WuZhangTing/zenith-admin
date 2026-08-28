/**
 * IoT 设备 WS 网关（/api/iot/ws）。
 *
 * 握手：query 携带 sn/ts/sign（body 为空串的 HMAC 签名），验签失败 4001 关闭。
 * 连接即在线；上线补推全部 pending 指令与未确认期望属性；断开即离线（HTTP 心跳设备可重建在线态）。
 *
 * 帧协议（JSON）：
 *   设备 → 服务端：{type:'heartbeat'} | {type:'telemetry',payload:IotTelemetryIngestInput}
 *                  | {type:'event',payload:IotEventIngestInput}
 *                  | {type:'command:ack',payload:{commandId,success,response?,errorMsg?}}
 *                  | {type:'ota:progress',payload:{taskId,status,progress?,errorMsg?}}
 *   服务端 → 设备：{type:'command:exec',payload:IotCommandPayload} | {type:'heartbeat:ack'}
 *                  | {type:'shadow:desired',payload:IotDesiredPayload}
 *                  | {type:'ota:upgrade',payload:IotOtaPayload}
 */
import { Hono } from 'hono';
import type { UpgradeWebSocket } from 'hono/ws';
import { z } from 'zod';
import {
  IOT_WS_FRAME_TYPES, iotTelemetryIngestSchema, iotCommandAckSchema, iotEventIngestSchema,
  iotGatewayBatchSchema, iotGatewayEventSchema, iotLogIngestSchema, iotOtaProgressSchema,
} from '@zenith/shared/iot';
import type { IotDeviceRow } from '../../db/schema';
import { authenticateDevice, markDeviceOnline, markDeviceOffline, touchDevice } from '../../services/iot/iot-access.service';
import {
  ingestTelemetry, ackIotCommand, getPendingCommandPayloads, markCommandsDelivered,
} from '../../services/iot/iot-telemetry.service';
import { ingestIotDeviceEvents } from '../../services/iot/iot-events.service';
import { ingestIotDeviceLogs } from '../../services/iot/iot-device-logs.service';
import { ingestGatewayBatch, ingestGatewayEvent } from '../../services/iot/iot-topology.service';
import { getIotDesiredPayload } from '../../services/iot/iot-shadow.service';
import { getPendingOtaPayload, reportIotOtaProgress } from '../../services/iot/iot-ota.service';
import { registerDeviceConnection, removeDeviceConnection } from '../../services/iot/iot-gateway.service';
import logger from '../../lib/logger';

const ackFrameSchema = iotCommandAckSchema.extend({ commandId: z.number().int().positive() });

export function createIotWsRoute(upgradeWebSocket: UpgradeWebSocket) {
  const wsApp = new Hono();

  wsApp.get(
    '/',
    upgradeWebSocket(async (c) => {
      let device: IotDeviceRow | null = null;
      try {
        device = await authenticateDevice(c.req.query('sn'), c.req.query('ts'), c.req.query('sign'), '');
      } catch {
        device = null;
      }

      return {
        onOpen(_evt, ws) {
          if (!device) {
            ws.close(4001, 'Unauthorized');
            return;
          }
          const d = device;
          registerDeviceConnection(d.sn, ws);
          // 在线登记 + 上线补推 pending 指令（推完统一标 delivered）、未确认期望属性与待升级固件
          void (async () => {
            await touchDevice(d);
            const [pendings, desired, ota] = await Promise.all([
              getPendingCommandPayloads(d.id),
              getIotDesiredPayload(d),
              getPendingOtaPayload(d),
            ]);
            if (pendings.length > 0) {
              for (const payload of pendings) {
                ws.send(JSON.stringify({ type: IOT_WS_FRAME_TYPES.commandExec, payload }));
              }
              await markCommandsDelivered(pendings.map((p) => p.commandId));
            }
            if (desired) {
              ws.send(JSON.stringify({ type: IOT_WS_FRAME_TYPES.shadowDesired, payload: desired }));
            }
            if (ota) {
              ws.send(JSON.stringify({ type: IOT_WS_FRAME_TYPES.otaUpgrade, payload: ota }));
            }
          })().catch((err) => {
            logger.warn(`[iot-ws] 上线处理失败 sn=${d.sn}: ${(err as Error).message}`);
          });
        },
        async onMessage(evt, ws) {
          if (!device) return;
          try {
            const frame = JSON.parse(typeof evt.data === 'string' ? evt.data : '') as { type?: string; payload?: unknown };
            switch (frame?.type) {
              case IOT_WS_FRAME_TYPES.heartbeat: {
                await markDeviceOnline(device.id);
                ws.send(JSON.stringify({ type: IOT_WS_FRAME_TYPES.heartbeatAck }));
                break;
              }
              case IOT_WS_FRAME_TYPES.telemetry: {
                const parsed = iotTelemetryIngestSchema.safeParse(frame.payload);
                if (parsed.success) await ingestTelemetry(device, parsed.data);
                break;
              }
              case IOT_WS_FRAME_TYPES.event: {
                const parsed = iotEventIngestSchema.safeParse(frame.payload);
                if (parsed.success) await ingestIotDeviceEvents(device, parsed.data);
                break;
              }
              case IOT_WS_FRAME_TYPES.log: {
                const parsed = iotLogIngestSchema.safeParse(frame.payload);
                if (parsed.success) await ingestIotDeviceLogs(device, parsed.data);
                break;
              }
              case IOT_WS_FRAME_TYPES.gatewayBatch: {
                const parsed = iotGatewayBatchSchema.safeParse(frame.payload);
                if (parsed.success) await ingestGatewayBatch(device, parsed.data);
                break;
              }
              case IOT_WS_FRAME_TYPES.gatewayEvent: {
                const parsed = iotGatewayEventSchema.safeParse(frame.payload);
                if (parsed.success) await ingestGatewayEvent(device, parsed.data);
                break;
              }
              case IOT_WS_FRAME_TYPES.otaProgress: {
                const parsed = iotOtaProgressSchema.safeParse(frame.payload);
                if (parsed.success) await reportIotOtaProgress(device, parsed.data).catch(() => { /* 任务已结束等业务性拒绝，忽略 */ });
                break;
              }
              case IOT_WS_FRAME_TYPES.commandAck: {
                const parsed = ackFrameSchema.safeParse(frame.payload);
                if (parsed.success) {
                  const { commandId, ...ack } = parsed.data;
                  await ackIotCommand(device, commandId, ack);
                }
                break;
              }
              default:
                break;
            }
          } catch { /* 忽略畸形帧 */ }
        },
        onClose(_evt, ws) {
          if (!device) return;
          removeDeviceConnection(device.sn, ws);
          void markDeviceOffline(device.id);
        },
        onError() {
          // 连接级错误由 WS 适配器处理，onClose 兜底清理
        },
      };
    }),
  );

  return wsApp;
}
