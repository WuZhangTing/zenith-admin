import { keepPreviousData, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { OutputOf, QueryOf } from '@zenith/shared/core';
import { iotFirmwareContract, iotOtaTaskContract, type IotOtaTask } from '@zenith/shared/iot';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { contractKey, createResourceQueries, urlOf, useApiMutation, useApiQuery } from '@/lib/contract-query';

// ─── 固件包 ───────────────────────────────────────────────────────────────────
export type IotFirmwareListParams = NonNullable<QueryOf<typeof iotFirmwareContract.list>>;

/** 固件只有列表 / 更新 / 删除走标准资源形态；上传为 multipart，见下方专用 hook */
export const {
  keys: iotFirmwareKeys,
  useList: useIotFirmwareList,
  useSave: useSaveIotFirmware,
  useDelete: useDeleteIotFirmwares,
} = createResourceQueries(iotFirmwareContract);

/** 上传固件（multipart，含进度回调，故走 XHR 表单通道而非 api()） */
export function useUploadIotFirmware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (percent: number) => void }) =>
      request.postForm<OutputOf<typeof iotFirmwareContract.upload>>(urlOf(iotFirmwareContract.upload), formData, { onProgress }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotFirmwareKeys.lists });
    },
  });
}

// ─── 升级任务 ─────────────────────────────────────────────────────────────────
export type IotOtaTaskListParams = NonNullable<QueryOf<typeof iotOtaTaskContract.list>>;

export const {
  keys: iotOtaTaskKeys,
  useList: useIotOtaTaskList,
  useDetail: useIotOtaTaskDetail,
} = createResourceQueries(iotOtaTaskContract);

/** 任务设备明细（进行中任务 5s 轮询跟进进度） */
export type IotOtaTaskDeviceListParams = NonNullable<QueryOf<typeof iotOtaTaskContract.devices>>;

export const iotOtaTaskDeviceKeys = {
  all: contractKey(iotOtaTaskContract.devices),
  ofTask: (taskId: number) => contractKey(iotOtaTaskContract.devices, { params: { id: taskId }, query: {} }),
};

export function useIotOtaTaskDevices(taskId: number | null, params: IotOtaTaskDeviceListParams, polling = false) {
  return useApiQuery(iotOtaTaskContract.devices, { params: { id: taskId ?? 0 }, query: params }, {
    enabled: taskId !== null,
    refetchInterval: polling ? 5_000 : false,
    placeholderData: keepPreviousData,
  });
}

/** 创建升级任务：任务与固件（任务数列）都要刷新 */
export function useCreateIotOtaTask() {
  return useApiMutation(iotOtaTaskContract.create, {
    invalidate: (qc) => {
      void qc.invalidateQueries({ queryKey: iotOtaTaskKeys.lists });
      void qc.invalidateQueries({ queryKey: iotFirmwareKeys.lists });
    },
  });
}

/** 任务状态变更后：详情直接写入缓存、列表失效；设备明细按需失效 */
function applyOtaTask(qc: QueryClient, saved: IotOtaTask, withDevices: boolean) {
  qc.setQueryData(iotOtaTaskKeys.detail(saved.id), saved);
  void qc.invalidateQueries({ queryKey: iotOtaTaskKeys.lists });
  if (withDevices) void qc.invalidateQueries({ queryKey: iotOtaTaskDeviceKeys.ofTask(saved.id) });
}

export function useCancelIotOtaTask() {
  return useApiMutation(iotOtaTaskContract.cancel, {
    invalidate: (qc, saved) => applyOtaTask(qc, saved, true),
  });
}

/** 灰度放量下一批：任务详情/列表与设备明细都刷新 */
export function useReleaseNextIotOtaBatch() {
  return useApiMutation(iotOtaTaskContract.releaseNextBatch, {
    invalidate: (qc, saved) => applyOtaTask(qc, saved, true),
  });
}

/** 恢复被熔断暂停的任务 */
export function useResumeIotOtaTask() {
  return useApiMutation(iotOtaTaskContract.resume, {
    invalidate: (qc, saved) => applyOtaTask(qc, saved, false),
  });
}
