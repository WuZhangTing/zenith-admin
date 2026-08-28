import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateIotOtaTaskInput, IotFirmware, IotOtaTask, IotOtaTaskDevice, UpdateIotFirmwareInput } from '@zenith/shared/iot';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

// ─── 固件包 ───────────────────────────────────────────────────────────────────
export interface IotFirmwareListParams extends CrudListParams {
  keyword?: string;
  productId?: number;
  status?: string;
}

export const iotFirmwareKeys = {
  all: ['iot-firmwares'] as const,
  lists: ['iot-firmwares', 'list'] as const,
  list: (params: IotFirmwareListParams) => ['iot-firmwares', 'list', params] as const,
};

export function useIotFirmwareList(params: IotFirmwareListParams) {
  return useQuery({
    queryKey: iotFirmwareKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<IotFirmware>>(`/api/iot/firmwares${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

/** 上传固件（multipart，含进度回调） */
export function useUploadIotFirmware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (percent: number) => void }) =>
      request.postForm<IotFirmware>('/api/iot/firmwares', formData, { onProgress }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotFirmwareKeys.lists });
    },
  });
}

export function useUpdateIotFirmware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: UpdateIotFirmwareInput }) =>
      request.put<IotFirmware>(`/api/iot/firmwares/${id}`, values).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotFirmwareKeys.lists });
    },
  });
}

export function useDeleteIotFirmware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/iot/firmwares/${id}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotFirmwareKeys.lists });
    },
  });
}

// ─── 升级任务 ─────────────────────────────────────────────────────────────────
export interface IotOtaTaskListParams extends CrudListParams {
  keyword?: string;
  productId?: number;
  status?: string;
}

export const {
  keys: iotOtaTaskKeys,
  useList: useIotOtaTaskList,
  useDetail: useIotOtaTaskDetail,
} = createCrudQueries<IotOtaTask, IotOtaTaskListParams>({
  resource: 'iot-ota-tasks',
  path: '/api/iot/ota-tasks',
});

/** 任务设备明细（进行中任务 5s 轮询跟进进度） */
export interface IotOtaTaskDeviceListParams {
  page: number;
  pageSize: number;
  status?: string;
}

export const iotOtaTaskDeviceKeys = {
  all: ['iot-ota-task-devices'] as const,
  of: (taskId: number, params: IotOtaTaskDeviceListParams) => ['iot-ota-task-devices', taskId, params] as const,
};

export function useIotOtaTaskDevices(taskId: number | null, params: IotOtaTaskDeviceListParams, polling = false) {
  return useQuery({
    queryKey: iotOtaTaskDeviceKeys.of(taskId ?? 0, params),
    queryFn: () => request.get<PaginatedResponse<IotOtaTaskDevice>>(
      `/api/iot/ota-tasks/${taskId}/devices${toQueryString(params)}`,
    ).then(unwrap),
    enabled: taskId !== null,
    refetchInterval: polling ? 5_000 : false,
    placeholderData: keepPreviousData,
  });
}

/** 创建升级任务：任务与固件（任务数列）都要刷新 */
export function useCreateIotOtaTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateIotOtaTaskInput) =>
      request.post<IotOtaTask>('/api/iot/ota-tasks', values).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotOtaTaskKeys.lists });
      void qc.invalidateQueries({ queryKey: iotFirmwareKeys.lists });
    },
  });
}

export function useCancelIotOtaTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<IotOtaTask>(`/api/iot/ota-tasks/${id}/cancel`, {}).then(unwrap),
    onSuccess: (saved) => {
      qc.setQueryData(iotOtaTaskKeys.detail(saved.id), saved);
      void qc.invalidateQueries({ queryKey: iotOtaTaskKeys.lists });
      void qc.invalidateQueries({ queryKey: [...iotOtaTaskDeviceKeys.all, saved.id] });
    },
  });
}
