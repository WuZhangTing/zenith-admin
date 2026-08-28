import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  IotBatchCommandInput, IotBatchDesiredInput, IotCommand, IotDevice, IotDeviceEvent,
  IotDeviceLog, IotDeviceShadow, IotDeviceTopology, IotTelemetryAggPoint, IotTelemetryPoint,
  SendIotCommandInput, SetIotDesiredInput,
} from '@zenith/shared/iot';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface IotDeviceListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  productId?: number;
  groupId?: number;
  nodeType?: string;
  gatewayId?: number;
  startTime?: string;
  endTime?: string;
}

export const {
  keys: iotDeviceKeys,
  useList: useIotDeviceList,
  useDetail: useIotDeviceDetail,
  useSave: useSaveIotDevice,
  useDelete: useDeleteIotDevices,
} = createCrudQueries<IotDevice, IotDeviceListParams, Partial<IotDevice>>({
  resource: 'iot-devices',
  path: '/api/iot/devices',
});

/** 重置接入密钥：详情（凭证展示）与列表都要刷新 */
export function useResetIotDeviceSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<IotDevice>(`/api/iot/devices/${id}/reset-secret`, {}).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.lists });
    },
  });
}

// ─── 遥测（独立命名空间：高频只读，不与设备 CRUD 连坐）────────────────────────
export const iotTelemetryKeys = {
  all: ['iot-telemetry'] as const,
  of: (deviceId: number, days: number) => ['iot-telemetry', deviceId, days] as const,
};

export function useIotTelemetry(deviceId: number | null, days = 1) {
  return useQuery({
    queryKey: iotTelemetryKeys.of(deviceId ?? 0, days),
    queryFn: () => request.get<IotTelemetryPoint[]>(`/api/iot/devices/${deviceId}/telemetry${toQueryString({ days })}`).then(unwrap),
    enabled: deviceId !== null,
  });
}

/** 清空遥测：遥测点列与列表快照（latestMetrics）都失效 */
export function useClearIotTelemetry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: number) => request.delete<null>(`/api/iot/devices/${deviceId}/telemetry`).then(unwrap),
    onSuccess: (_data, deviceId) => {
      void qc.invalidateQueries({ queryKey: [...iotTelemetryKeys.all, deviceId] });
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.lists });
    },
  });
}

// ─── 指令 ─────────────────────────────────────────────────────────────────────
export interface IotCommandListParams {
  page: number;
  pageSize: number;
}

export const iotCommandKeys = {
  all: ['iot-commands'] as const,
  of: (deviceId: number, params: IotCommandListParams) => ['iot-commands', deviceId, params] as const,
};

export function useIotCommands(deviceId: number | null, params: IotCommandListParams) {
  return useQuery({
    queryKey: iotCommandKeys.of(deviceId ?? 0, params),
    queryFn: () => request.get<{ list: IotCommand[]; total: number; page: number; pageSize: number }>(
      `/api/iot/devices/${deviceId}/commands${toQueryString(params)}`,
    ).then(unwrap),
    enabled: deviceId !== null,
  });
}

export function useSendIotCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, values }: { deviceId: number; values: SendIotCommandInput }) =>
      request.post<IotCommand>(`/api/iot/devices/${deviceId}/commands`, values).then(unwrap),
    onSuccess: (_saved, { deviceId }) => {
      void qc.invalidateQueries({ queryKey: [...iotCommandKeys.all, deviceId] });
    },
  });
}

// ─── 设备影子 ─────────────────────────────────────────────────────────────────
export const iotShadowKeys = {
  all: ['iot-shadow'] as const,
  of: (deviceId: number) => ['iot-shadow', deviceId] as const,
};

export function useIotDeviceShadow(deviceId: number | null) {
  return useQuery({
    queryKey: iotShadowKeys.of(deviceId ?? 0),
    queryFn: () => request.get<IotDeviceShadow>(`/api/iot/devices/${deviceId}/shadow`).then(unwrap),
    enabled: deviceId !== null,
    // 详情面板打开期间轮询：设备回报后 desired 收敛、reported 更新
    refetchInterval: 10_000,
  });
}

/** 设置/清空期望属性：影子、设备详情与列表快照（desired 列）都要刷新 */
export function useSetIotDesired() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, values }: { deviceId: number; values: SetIotDesiredInput }) =>
      request.put<IotDeviceShadow>(`/api/iot/devices/${deviceId}/shadow/desired`, values).then(unwrap),
    onSuccess: (saved, { deviceId }) => {
      qc.setQueryData(iotShadowKeys.of(deviceId), saved);
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.detail(deviceId) });
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.lists });
    },
  });
}

export function useClearIotDesired() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: number) =>
      request.delete<IotDeviceShadow>(`/api/iot/devices/${deviceId}/shadow/desired`).then(unwrap),
    onSuccess: (saved, deviceId) => {
      qc.setQueryData(iotShadowKeys.of(deviceId), saved);
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.detail(deviceId) });
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.lists });
    },
  });
}

// ─── 设备事件流 ───────────────────────────────────────────────────────────────
export interface IotDeviceEventListParams {
  page: number;
  pageSize: number;
  kind?: string;
  level?: string;
}

export const iotDeviceEventKeys = {
  all: ['iot-device-events'] as const,
  of: (deviceId: number, params: IotDeviceEventListParams) => ['iot-device-events', deviceId, params] as const,
};

export function useIotDeviceEvents(deviceId: number | null, params: IotDeviceEventListParams) {
  return useQuery({
    queryKey: iotDeviceEventKeys.of(deviceId ?? 0, params),
    queryFn: () => request.get<PaginatedResponse<IotDeviceEvent>>(
      `/api/iot/devices/${deviceId}/events${toQueryString(params)}`,
    ).then(unwrap),
    enabled: deviceId !== null,
  });
}

// ─── 遥测聚合（长窗口图表：min/max/avg 区间带）────────────────────────────────
export const iotTelemetryAggKeys = {
  all: ['iot-telemetry-agg'] as const,
  of: (deviceId: number, property: string, days: number) => ['iot-telemetry-agg', deviceId, property, days] as const,
};

export function useIotTelemetryAgg(deviceId: number | null, property: string | null, days: number) {
  return useQuery({
    queryKey: iotTelemetryAggKeys.of(deviceId ?? 0, property ?? '', days),
    queryFn: () => request.get<IotTelemetryAggPoint[]>(
      `/api/iot/devices/${deviceId}/telemetry/agg${toQueryString({ property, days })}`,
    ).then(unwrap),
    enabled: deviceId !== null && property !== null,
  });
}

// ─── Excel 导入 ───────────────────────────────────────────────────────────────
export interface IotDeviceImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export function useImportIotDevices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (percent: number) => void }) =>
      request.postForm<IotDeviceImportResult>('/api/iot/devices/import', formData, { onProgress }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotDeviceKeys.lists });
    },
  });
}

// ─── 批量操作（任务中心执行，进度走全局 TaskTray，无缓存联动）──────────────────
export interface SubmittedAsyncTask {
  id: number;
  taskType: string;
  title: string;
  status: string;
}

export function useSubmitIotBatchCommand() {
  return useMutation({
    mutationFn: (values: IotBatchCommandInput) =>
      request.post<SubmittedAsyncTask>('/api/iot/batch/commands', values).then(unwrap),
  });
}

export function useSubmitIotBatchDesired() {
  return useMutation({
    mutationFn: (values: IotBatchDesiredInput) =>
      request.post<SubmittedAsyncTask>('/api/iot/batch/desired', values).then(unwrap),
  });
}

// ─── 五期：网关拓扑 / 设备日志 ────────────────────────────────────────────────
export const iotTopologyKeys = {
  of: (deviceId: number) => ['iot-topology', deviceId] as const,
};

export function useIotDeviceTopology(deviceId: number | null, enabled = true) {
  return useQuery({
    queryKey: iotTopologyKeys.of(deviceId ?? 0),
    queryFn: () => request.get<IotDeviceTopology>(`/api/iot/devices/${deviceId}/topology`).then(unwrap),
    enabled: enabled && deviceId !== null,
  });
}

export interface IotDeviceLogListParams {
  page?: number;
  pageSize?: number;
  level?: string;
  keyword?: string;
}

export const iotDeviceLogKeys = {
  of: (deviceId: number, params: IotDeviceLogListParams) => ['iot-device-logs', deviceId, params] as const,
};

export function useIotDeviceLogs(deviceId: number | null, params: IotDeviceLogListParams, enabled = true) {
  return useQuery({
    queryKey: iotDeviceLogKeys.of(deviceId ?? 0, params),
    queryFn: () => request.get<PaginatedResponse<IotDeviceLog>>(
      `/api/iot/devices/${deviceId}/logs${toQueryString(params)}`,
    ).then(unwrap),
    enabled: enabled && deviceId !== null,
  });
}
