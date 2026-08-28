/**
 * IoT 批量操作任务（任务中心 handler）：批量下发指令 / 批量设置期望属性。
 *
 * 提交入口在 routes/iot/batch.ts；目标设备集在提交时已展开为具体 id 列表。
 * handler 内框架已还原提交者身份，直接复用带行级权限的 service 函数；
 * 单台设备失败计入行级明细，不中断整批。
 */
import { registerTaskHandler } from '../../lib/task-center';
import { sendIotCommand } from './iot-telemetry.service';
import { setIotDesired } from './iot-shadow.service';

interface BatchCommandPayload {
  deviceIds: number[];
  deviceNames: Record<number, string>;
  service: string;
  params: Record<string, unknown> | null;
  ttlSeconds?: number;
}

interface BatchDesiredPayload {
  deviceIds: number[];
  deviceNames: Record<number, string>;
  desired: Record<string, number | string | boolean>;
}

export function registerIotBatchTaskHandlers(): void {
  registerTaskHandler({
    taskType: 'iot-batch-command',
    title: 'IoT 批量下发指令',
    module: 'IoT 设备',
    allowConcurrent: false,
    async run(ctx) {
      const payload = ctx.payload as unknown as BatchCommandPayload;
      const deviceIds = payload.deviceIds ?? [];
      let processed = Number(ctx.checkpoint?.processed ?? 0);
      let succeeded = Number(ctx.checkpoint?.succeeded ?? 0);
      for (let i = processed; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        const label = payload.deviceNames?.[deviceId] ?? `设备 #${deviceId}`;
        try {
          const row = await sendIotCommand(deviceId, {
            service: payload.service,
            params: payload.params,
            ttlSeconds: payload.ttlSeconds,
          });
          succeeded += 1;
          await ctx.reportItems([{
            key: `device-${deviceId}`,
            label,
            status: 'success',
            message: row.status === 'delivered' ? '已实时送达' : '离线，待上线补发',
          }]);
        } catch (err) {
          await ctx.reportItems([{
            key: `device-${deviceId}`,
            label,
            status: 'failed',
            message: (err as Error).message ?? '下发失败',
          }]);
        }
        processed = i + 1;
        const { cancelRequested } = await ctx.progress({
          processed,
          total: deviceIds.length,
          note: `已处理 ${processed}/${deviceIds.length} 台（成功 ${succeeded}）`,
          checkpoint: { processed, succeeded },
        });
        if (cancelRequested) return;
      }
      return { processed, succeeded, failed: processed - succeeded };
    },
  });

  registerTaskHandler({
    taskType: 'iot-batch-desired',
    title: 'IoT 批量设置期望属性',
    module: 'IoT 设备',
    allowConcurrent: false,
    async run(ctx) {
      const payload = ctx.payload as unknown as BatchDesiredPayload;
      const deviceIds = payload.deviceIds ?? [];
      let processed = Number(ctx.checkpoint?.processed ?? 0);
      let succeeded = Number(ctx.checkpoint?.succeeded ?? 0);
      for (let i = processed; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        const label = payload.deviceNames?.[deviceId] ?? `设备 #${deviceId}`;
        try {
          await setIotDesired(deviceId, { desired: payload.desired });
          succeeded += 1;
          await ctx.reportItems([{ key: `device-${deviceId}`, label, status: 'success', message: null }]);
        } catch (err) {
          await ctx.reportItems([{
            key: `device-${deviceId}`,
            label,
            status: 'failed',
            message: (err as Error).message ?? '设置失败',
          }]);
        }
        processed = i + 1;
        const { cancelRequested } = await ctx.progress({
          processed,
          total: deviceIds.length,
          note: `已处理 ${processed}/${deviceIds.length} 台（成功 ${succeeded}）`,
          checkpoint: { processed, succeeded },
        });
        if (cancelRequested) return;
      }
      return { processed, succeeded, failed: processed - succeeded };
    },
  });
}
