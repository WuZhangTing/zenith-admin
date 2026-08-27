import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IotCommand, IotDevice, IotTelemetryPoint, SendIotCommandInput } from '@zenith/shared/iot';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface IotDeviceListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  productId?: number;
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
