/**
 * IoT 设备侧接入 API（/api/iot/ingest/*，设备 HMAC 签名鉴权，无管理端 token）。
 *
 * 签名基于原始请求体文本，因此这里手动 text→zod 校验而非 openapi validator。
 * 全局 pathBoundRateLimit 已覆盖 /api/*，平台「限流规则」配 /api/iot/ingest/* 即可精细限流。
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type * as z from 'zod';
import {
  IOT_SN_HEADER, IOT_TIMESTAMP_HEADER, IOT_SIGN_HEADER,
  iotTelemetryIngestSchema, iotCommandAckSchema, iotEventIngestSchema,
  iotGatewayBatchSchema, iotGatewayEventSchema, iotLogIngestSchema, iotOtaProgressSchema,
  iotRegisterDeviceSchema,
} from '@zenith/shared/iot';
import { authenticateDevice, touchDevice } from '../../services/iot/iot-access.service';
import { ingestTelemetry, pullPendingCommands, ackIotCommand } from '../../services/iot/iot-telemetry.service';
import { ingestIotDeviceEvents } from '../../services/iot/iot-events.service';
import { ingestIotDeviceLogs } from '../../services/iot/iot-device-logs.service';
import { ingestGatewayBatch, ingestGatewayEvent } from '../../services/iot/iot-topology.service';
import { getIotDesiredPayload } from '../../services/iot/iot-shadow.service';
import { ensureOtaDownloadAllowed, getPendingOtaPayload, reportIotOtaProgress } from '../../services/iot/iot-ota.service';
import { getFileAccessUrl } from '../../services/files/files.service';
import { okBody } from '../../lib/openapi-schemas';
import type { IotDeviceRow } from '../../db/schema';

const ingestRouter = new Hono();

/** 读取原始 body → 验签 → zod 校验，返回设备行与解析后的数据 */
async function authAndParse<T extends z.ZodTypeAny>(
  c: { req: { header: (name: string) => string | undefined; text: () => Promise<string> } },
  schema: T,
): Promise<{ device: IotDeviceRow; data: z.infer<T> }> {
  const rawBody = await c.req.text();
  const device = await authenticateDevice(
    c.req.header(IOT_SN_HEADER),
    c.req.header(IOT_TIMESTAMP_HEADER),
    c.req.header(IOT_SIGN_HEADER),
    rawBody,
  );
  let json: unknown = {};
  if (rawBody) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new HTTPException(400, { message: '请求体不是合法 JSON' });
    }
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? '参数校验失败' });
  }
  return { device, data: parsed.data as z.infer<T> };
}

/** POST /telemetry — 批量上报遥测（自动续期在线态） */
ingestRouter.post('/telemetry', async (c) => {
  const { device, data } = await authAndParse(c, iotTelemetryIngestSchema);
  const count = await ingestTelemetry(device, data);
  return c.json(okBody({ accepted: count }));
});

/** POST /events — 批量上报设备事件（按物模型解析级别，触发事件类告警） */
ingestRouter.post('/events', async (c) => {
  const { device, data } = await authAndParse(c, iotEventIngestSchema);
  const count = await ingestIotDeviceEvents(device, data);
  await touchDevice(device);
  return c.json(okBody({ accepted: count }));
});

/** POST /logs — 批量上报设备运行日志 */
ingestRouter.post('/logs', async (c) => {
  const { device, data } = await authAndParse(c, iotLogIngestSchema);
  const count = await ingestIotDeviceLogs(device, data);
  await touchDevice(device);
  return c.json(okBody({ accepted: count }));
});

/** POST /gateway/telemetry — 网关批量代理子设备遥测（网关身份签名，子设备免密） */
ingestRouter.post('/gateway/telemetry', async (c) => {
  const { device, data } = await authAndParse(c, iotGatewayBatchSchema);
  const result = await ingestGatewayBatch(device, data);
  await touchDevice(device);
  return c.json(okBody(result));
});

/** POST /gateway/events — 网关代理子设备事件 */
ingestRouter.post('/gateway/events', async (c) => {
  const { device, data } = await authAndParse(c, iotGatewayEventSchema);
  const accepted = await ingestGatewayEvent(device, data);
  await touchDevice(device);
  return c.json(okBody({ accepted: accepted ? 1 : 0, rejected: accepted ? 0 : 1 }));
});

/** POST /heartbeat — 心跳（body 可为空对象），响应携带待执行指令、期望属性与待升级固件 */
ingestRouter.post('/heartbeat', async (c) => {
  const rawBody = await c.req.text();
  const device = await authenticateDevice(
    c.req.header(IOT_SN_HEADER),
    c.req.header(IOT_TIMESTAMP_HEADER),
    c.req.header(IOT_SIGN_HEADER),
    rawBody,
  );
  await touchDevice(device);
  const [commands, desired, ota] = await Promise.all([
    pullPendingCommands(device),
    getIotDesiredPayload(device),
    getPendingOtaPayload(device),
  ]);
  return c.json(okBody({ commands, desired, ota }));
});

/** POST /ota/progress — OTA 进度回报（downloading/installing 带进度，succeeded/failed 终态） */
ingestRouter.post('/ota/progress', async (c) => {
  const { device, data } = await authAndParse(c, iotOtaProgressSchema);
  await reportIotOtaProgress(device, data);
  return c.json(okBody(null, '进度已记录'));
});

/** GET /ota/firmware?taskId=N — 固件下载（query 携带 sn/ts/sign，对空串签名；302 跳转存储直链） */
ingestRouter.get('/ota/firmware', async (c) => {
  const device = await authenticateDevice(c.req.query('sn'), c.req.query('ts'), c.req.query('sign'), '');
  const taskId = Number(c.req.query('taskId'));
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new HTTPException(400, { message: '任务 ID 不合法' });
  }
  const fileId = await ensureOtaDownloadAllowed(device, taskId);
  const { url } = await getFileAccessUrl(fileId, 'download');
  return c.redirect(url, 302);
});

/** POST /commands/:commandId/ack — 指令执行回执 */
ingestRouter.post('/commands/:commandId/ack', async (c) => {
  const commandId = Number(c.req.param('commandId'));
  if (!Number.isInteger(commandId) || commandId <= 0) {
    throw new HTTPException(400, { message: '指令 ID 不合法' });
  }
  const { device, data } = await authAndParse(c, iotCommandAckSchema);
  await ackIotCommand(device, commandId, data);
  return c.json(okBody(null, '回执已记录'));
});

/** POST /register — 一型一密动态注册（产品注册密钥签名，白名单核销后返回设备密钥） */
ingestRouter.post('/register', async (c) => {
  const rawBody = await c.req.text();
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new HTTPException(400, { message: '请求体不是合法 JSON' });
  }
  const parsed = iotRegisterDeviceSchema.safeParse(json);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? '参数校验失败' });
  }
  const { registerIotDevice } = await import('../../services/iot/iot-register.service');
  const result = await registerIotDevice(parsed.data, {
    ts: c.req.header(IOT_TIMESTAMP_HEADER),
    sign: c.req.header(IOT_SIGN_HEADER),
    rawBody,
  });
  return c.json(okBody(result, '注册成功，请持久化设备密钥'));
});

export default ingestRouter;
