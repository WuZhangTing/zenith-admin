/**
 * IoT 接入侧派生动作队列：按设备串行、跨设备并行。
 *
 * 遥测落库 + 影子合并完成即可回执设备；阈值告警 / 场景联动 / 异常检测 / 数据流转等
 * 派生动作在此异步执行，不再阻塞接入响应：
 * - 同一设备的任务严格按入队顺序执行（阈值告警的「连续 N 点」抖动抑制依赖点序）
 * - 每设备待执行上限 MAX_PENDING_PER_DEVICE，超出则丢弃新任务并记日志
 *   （遥测本身已落库，只降级派生动作，避免单台异常设备把进程内存打满）
 * - 停机时 `drainIotDeviceWork()` 等待在途任务收敛，超时由调用方兜底
 */
import logger from '../../lib/logger';

export const MAX_PENDING_PER_DEVICE = 200;

interface DeviceChain {
  tail: Promise<void>;
  pending: number;
}

const chains = new Map<number, DeviceChain>();
let inFlight = 0;
let dropped = 0;

/** 入队；返回 false 表示因积压被丢弃 */
export function enqueueIotDeviceWork(deviceId: number, label: string, work: () => Promise<void>): boolean {
  const chain = chains.get(deviceId) ?? { tail: Promise.resolve(), pending: 0 };
  if (chain.pending >= MAX_PENDING_PER_DEVICE) {
    dropped += 1;
    if (dropped === 1 || dropped % 100 === 0) {
      logger.warn(`[iot-queue] deviceId=${deviceId} 派生任务积压超过 ${MAX_PENDING_PER_DEVICE}，累计丢弃 ${dropped} 个（${label}）`);
    }
    return false;
  }
  chain.pending += 1;
  inFlight += 1;
  const next = chain.tail
    .then(() => work())
    .catch((err) => {
      logger.warn(`[iot-queue] ${label} 执行失败 deviceId=${deviceId}: ${(err as Error).message}`);
    })
    .finally(() => {
      chain.pending -= 1;
      inFlight -= 1;
      if (chain.pending === 0 && chains.get(deviceId) === chain) chains.delete(deviceId);
    });
  chain.tail = next;
  chains.set(deviceId, chain);
  return true;
}

export function getIotDeviceWorkStats() {
  return { inFlight, devices: chains.size, dropped };
}

/** 停机排空：等待全部在途任务完成或超时；返回是否已清空 */
export async function drainIotDeviceWork(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (inFlight > 0 && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  return inFlight === 0;
}
