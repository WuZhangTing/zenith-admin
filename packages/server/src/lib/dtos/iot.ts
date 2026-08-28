/**
 * IoT 设备管理 DTO
 */
import { z } from '@hono/zod-openapi';
import {
  IOT_ACCESS_MODES, IOT_ALARM_LEVELS, IOT_ALARM_RULE_TYPES, IOT_ALARM_STATUSES,
  IOT_AUTOMATION_ACTION_TYPES, IOT_AUTOMATION_TARGETS, IOT_AUTOMATION_TRIGGERS,
  IOT_COMMAND_STATUSES, IOT_COMPARE_OPS, IOT_DEVICE_EVENT_KINDS, IOT_EVENT_LEVELS,
  IOT_OTA_DEVICE_STATUSES, IOT_OTA_TASK_STATUSES,
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

export const IotTelemetryAggPointDTO = z
  .object({
    bucket: z.string(),
    minValue: z.number(),
    maxValue: z.number(),
    avgValue: z.number(),
    count: z.number().int(),
  })
  .openapi('IotTelemetryAggPoint');

export const IotFirmwareDTO = z
  .object({
    id: z.number().int(),
    productId: z.number().int(),
    productName: z.string().nullable(),
    version: z.string(),
    fileId: z.string().nullable(),
    fileName: z.string(),
    size: z.number().int(),
    sha256: z.string(),
    releaseNotes: z.string().nullable(),
    status: z.enum(['enabled', 'disabled']),
    taskCount: z.number().int(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotFirmware');

export const IotOtaTaskDTO = z
  .object({
    id: z.number().int(),
    title: z.string(),
    firmwareId: z.number().int(),
    productId: z.number().int(),
    productName: z.string().nullable(),
    firmwareVersion: z.string(),
    status: z.enum(IOT_OTA_TASK_STATUSES),
    timeoutMinutes: z.number().int(),
    totalCount: z.number().int(),
    succeededCount: z.number().int(),
    failedCount: z.number().int(),
    createdBy: z.number().int().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotOtaTask');

export const IotOtaTaskDeviceDTO = z
  .object({
    id: z.number().int(),
    taskId: z.number().int(),
    deviceId: z.number().int(),
    deviceName: z.string().nullable(),
    deviceSn: z.string().nullable(),
    online: z.boolean().optional(),
    status: z.enum(IOT_OTA_DEVICE_STATUSES),
    progress: z.number().int(),
    fromVersion: z.string().nullable(),
    errorMsg: z.string().nullable(),
    notifiedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
  })
  .openapi('IotOtaTaskDevice');

export const IotDashboardDTO = z
  .object({
    stats: z.object({
      deviceTotal: z.number().int(),
      onlineCount: z.number().int(),
      onlineRate: z.number(),
      telemetryToday: z.number().int(),
      firingWarning: z.number().int(),
      firingCritical: z.number().int(),
      pendingDesiredDevices: z.number().int(),
      productTotal: z.number().int(),
    }),
    onlineTrend: z.array(z.object({ time: z.string(), total: z.number().int(), online: z.number().int() })),
    alarmTrend: z.array(z.object({ date: z.string(), warning: z.number().int(), critical: z.number().int() })),
    productDistribution: z.array(z.object({ name: z.string(), value: z.number().int() })),
    recentAlarms: z.array(IotAlarmDTO.extend({
      deviceName: z.string().nullable().optional(),
      deviceSn: z.string().nullable().optional(),
    })),
    recentEvents: z.array(IotDeviceEventDTO.extend({ deviceName: z.string().nullable().optional() })),
  })
  .openapi('IotDashboard');

const automationActionDef = z.object({
  type: z.enum(IOT_AUTOMATION_ACTION_TYPES),
  target: z.enum(IOT_AUTOMATION_TARGETS).optional(),
  targetDeviceId: z.number().int().nullable().optional(),
  targetGroupId: z.number().int().nullable().optional(),
  service: z.string().nullable().optional(),
  params: z.record(z.string(), z.unknown()).nullable().optional(),
  desired: z.record(z.string(), metricValue).nullable().optional(),
  userIds: z.array(z.number().int()).nullable().optional(),
  workflowDefinitionId: z.number().int().nullable().optional(),
  formData: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const IotAutomationDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    productId: z.number().int(),
    productName: z.string().nullable(),
    deviceId: z.number().int().nullable(),
    deviceName: z.string().nullable(),
    triggerType: z.enum(IOT_AUTOMATION_TRIGGERS),
    propertyIdentifier: z.string().nullable(),
    operator: z.enum(IOT_COMPARE_OPS).nullable(),
    threshold: z.number().nullable(),
    eventIdentifier: z.string().nullable(),
    decisionRuleKey: z.string().nullable(),
    cooldownSeconds: z.number().int(),
    actions: z.array(automationActionDef),
    status: z.enum(['enabled', 'disabled']),
    recentRunCount: z.number().int(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('IotAutomation');

export const IotAutomationRunDTO = z
  .object({
    id: z.number().int(),
    automationId: z.number().int(),
    automationName: z.string(),
    deviceId: z.number().int(),
    deviceName: z.string().nullable(),
    deviceSn: z.string().nullable(),
    triggerContext: z.record(z.string(), z.unknown()),
    results: z.array(z.object({
      type: z.string(),
      target: z.string().optional(),
      success: z.boolean(),
      message: z.string().optional(),
    })),
    success: z.boolean(),
    createdAt: z.string(),
  })
  .openapi('IotAutomationRun');

// ─── 开放 API DTO（对外以 SN 寻址，不暴露内部 id）─────────────────────────────
export const OpenIotDeviceDTO = z
  .object({
    sn: z.string(),
    name: z.string(),
    productId: z.number().int(),
    productName: z.string().nullable(),
    status: z.enum(['enabled', 'disabled']),
    online: z.boolean(),
    firmwareVersion: z.string().nullable(),
    activatedAt: z.string().nullable(),
    lastSeenAt: z.string().nullable(),
  })
  .openapi('OpenIotDevice');

export const OpenIotDeviceDetailDTO = OpenIotDeviceDTO
  .extend({
    shadow: z.object({
      reported: z.record(z.string(), metricValue),
      desired: z.record(z.string(), metricValue),
      desiredVersion: z.number().int(),
      reportedAt: z.string().nullable(),
      desiredAt: z.string().nullable(),
    }),
  })
  .openapi('OpenIotDeviceDetail');
