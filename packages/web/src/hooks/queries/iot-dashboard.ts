import { useQuery } from '@tanstack/react-query';
import type { IotDashboard } from '@zenith/shared/iot';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const iotDashboardKeys = {
  all: ['iot-dashboard'] as const,
};

export function useIotDashboard() {
  return useQuery({
    queryKey: iotDashboardKeys.all,
    queryFn: () => request.get<IotDashboard>('/api/iot/dashboard').then(unwrap),
    // 总览页驻留期间自动刷新（在线率/告警为运行态数据）
    refetchInterval: 30_000,
  });
}
