/**
 * IoT 设备管理 DTO
 */
import { z } from '@hono/zod-openapi';
import {
  IOT_ACCESS_MODES, IOT_ALARM_LEVELS, IOT_ALARM_RULE_TYPES, IOT_ALARM_STATUSES,
  IOT_COMMAND_STATUSES, IOT_COMPARE_OPS, IOT_DEVICE_EVENT_KINDS, IOT_EVENT_LEVELS,
  IOT_PROPERTY_TYPES, IOT_VALIDATION_MODES,
} from '@zenith/shared/iot';
import { auditFields } from './_audit';

const metricValue = z.union([z.number(), z.string(), z.boolean()]);

export const IotProductDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    validationMode: z.enum(IOT_VALIDATION_MODES),
    status: z.enum(['enabled', 'disabled']),
    deviceCount: z.number().int(),
    propertyCount: z.number().int(),
    serviceCount: z.number().int(),
    eventCount: z.number().int(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotProduct');

const paramDef = z.object({
  identifier: z.string(),
  name: z.string(),
  dataType: z.enum(IOT_PROPERTY_TYPES),
  required: z.boolean().optional(),
  unit: z.string().nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  enumOptions: z.record(z.string(), z.string()).nullable().optional(),
});

export const IotProductPropertyDTO = z
  .object({
    id: z.number().int(),
    productId: z.number().int(),
    identifier: z.string(),
    name: z.string(),
    dataType: z.enum(IOT_PROPERTY_TYPES),
    accessMode: z.enum(IOT_ACCESS_MODES),
    unit: z.string().nullable(),
    minValue: z.number().nullable(),
    maxValue: z.number().nullable(),
    enumOptions: z.record(z.string(), z.string()).nullable(),
    featured: z.boolean(),
    sort: z.number().int(),
    description: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotProductProperty');

export const IotProductServiceDTO = z
  .object({
    id: z.number().int(),
    productId: z.number().int(),
    identifier: z.string(),
    name: z.string(),
    params: z.array(paramDef),
    danger: z.boolean(),
    sort: z.number().int(),
    description: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotProductService');

export const IotProductEventDTO = z
  .object({
    id: z.number().int(),
    productId: z.number().int(),
    identifier: z.string(),
    name: z.string(),
    level: z.enum(IOT_EVENT_LEVELS),
    params: z.array(paramDef),
    sort: z.number().int(),
    description: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotProductEvent');

export const IotThingModelDTO = z
  .object({
    properties: z.array(IotProductPropertyDTO),
    services: z.array(IotProductServiceDTO),
    events: z.array(IotProductEventDTO),
  })
  .openapi('IotThingModel');

export const IotDeviceDTO = z
  .object({
    id: z.number().int(),
    sn: z.string().openapi({ example: 'SN-A1B2C3D4E5F60708' }),
    secret: z.string(),
    productId: z.number().int(),
    productName: z.string().nullable(),
    name: z.string(),
    status: z.enum(['enabled', 'disabled']),
    online: z.boolean(),
    firmwareVersion: z.string().nullable(),
    activatedAt: z.string().nullable(),
    lastSeenAt: z.string().nullable(),
    reported: z.record(z.string(), metricValue).nullable(),
    desired: z.record(z.string(), metricValue).nullable(),
    groupIds: z.array(z.number().int()),
    groupNames: z.array(z.string()),
    remark: z.string().nullable(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotDevice');

export const IotDeviceShadowDTO = z
  .object({
    deviceId: z.number().int(),
    reported: z.record(z.string(), metricValue),
    reportedAt: z.string().nullable(),
    desired: z.record(z.string(), metricValue),
    desiredVersion: z.number().int(),
    desiredAt: z.string().nullable(),
    online: z.boolean(),
    updatedAt: z.string(),
  })
  .openapi('IotDeviceShadow');

export const IotDeviceEventDTO = z
  .object({
    id: z.number().int(),
    deviceId: z.number().int(),
    kind: z.enum(IOT_DEVICE_EVENT_KINDS),
    identifier: z.string(),
    name: z.string(),
    level: z.enum(IOT_EVENT_LEVELS),
    payload: z.record(z.string(), z.unknown()).nullable(),
    reportedAt: z.string(),
  })
  .openapi('IotDeviceEvent');

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

export const IotAlarmRuleDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    productId: z.number().int(),
    productName: z.string().nullable(),
    deviceId: z.number().int().nullable(),
    deviceName: z.string().nullable(),
    ruleType: z.enum(IOT_ALARM_RULE_TYPES),
    propertyIdentifier: z.string().nullable(),
    operator: z.enum(IOT_COMPARE_OPS).nullable(),
    threshold: z.number().nullable(),
    consecutiveCount: z.number().int(),
    offlineMinutes: z.number().int().nullable(),
    eventIdentifier: z.string().nullable(),
    level: z.enum(IOT_ALARM_LEVELS),
    notifyUserIds: z.array(z.number().int()),
    status: z.enum(['enabled', 'disabled']),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotAlarmRule');

export const IotAlarmDTO = z
  .object({
    id: z.number().int(),
    ruleId: z.number().int().nullable(),
    ruleName: z.string(),
    deviceId: z.number().int(),
    deviceName: z.string().nullable(),
    deviceSn: z.string().nullable(),
    ruleType: z.enum(IOT_ALARM_RULE_TYPES),
    level: z.enum(IOT_ALARM_LEVELS),
    status: z.enum(IOT_ALARM_STATUSES),
    message: z.string(),
    context: z.record(z.string(), z.unknown()).nullable(),
    firedAt: z.string(),
    resolvedAt: z.string().nullable(),
    resolvedBy: z.number().int().nullable(),
    createdAt: z.string(),
  })
  .openapi('IotAlarm');

export const IotDeviceGroupDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    deviceCount: z.number().int(),
    deviceIds: z.array(z.number().int()),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotDeviceGroup');
