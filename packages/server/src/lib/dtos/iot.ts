/**
 * IoT 设备管理 DTO
 */
import { z } from '@hono/zod-openapi';
import { IOT_COMMAND_STATUSES } from '@zenith/shared/iot';
import { auditFields } from './_audit';

const metricValue = z.union([z.number(), z.string(), z.boolean()]);

export const IotProductDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    keyMetrics: z.array(z.string()),
    description: z.string().nullable(),
    status: z.enum(['enabled', 'disabled']),
    deviceCount: z.number().int(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotProduct');

export const IotDeviceDTO = z
  .object({
    id: z.number().int(),
    sn: z.string().openapi({ example: 'SN-A1B2C3D4E5F60708' }),
    secret: z.string(),
    productId: z.number().int(),
    productName: z.string().nullable(),
    keyMetrics: z.array(z.string()),
    name: z.string(),
    status: z.enum(['enabled', 'disabled']),
    online: z.boolean(),
    firmwareVersion: z.string().nullable(),
    activatedAt: z.string().nullable(),
    lastSeenAt: z.string().nullable(),
    latestMetrics: z.record(z.string(), metricValue).nullable(),
    remark: z.string().nullable(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotDevice');

export const IotTelemetryPointDTO = z
  .object({
    id: z.number().int(),
    metrics: z.record(z.string(), metricValue),
    reportedAt: z.string(),
  })
  .openapi('IotTelemetryPoint');

export const IotCommandDTO = z
  .object({
    id: z.number().int(),
    deviceId: z.number().int(),
    service: z.string(),
    params: z.record(z.string(), z.unknown()).nullable(),
    status: z.enum(IOT_COMMAND_STATUSES),
    expireAt: z.string(),
    sentAt: z.string().nullable(),
    ackedAt: z.string().nullable(),
    response: z.record(z.string(), z.unknown()).nullable(),
    errorMsg: z.string().nullable(),
    createdBy: z.number().int().nullable().optional(),
    createdAt: z.string(),
  })
  .openapi('IotCommand');
