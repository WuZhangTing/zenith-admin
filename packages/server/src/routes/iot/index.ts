import { upgradeWebSocket } from '@hono/node-server';
import { defineRouteDomain } from '../_kit';
import iotProductsRoutes from './iot-products';
import iotDevicesRoutes from './iot-devices';
import iotGroupsRoutes from './iot-groups';
import iotBatchRoutes from './batch';
import { iotAlarmsRouter, iotAlarmRulesRouter, iotMaintenanceWindowsRouter } from './iot-alarms';
import { iotAutomationsRouter } from './iot-automations';
import { iotForwardRulesRouter } from './iot-forwards';
import { iotSchedulesRouter } from './iot-schedules';
import { iotWhitelistRouter } from './iot-register';
import { iotDashboardRouter, iotFirmwaresRouter, iotOtaTasksRouter } from './iot-ota';
import ingestRoutes from './ingest';
import { createIotWsRoute } from './ws';

export default defineRouteDomain({
  name: 'iot',
  mounts: () => [
    ['/api/iot/dashboard', iotDashboardRouter],
    ['/api/iot/products', iotProductsRoutes],
    ['/api/iot/devices', iotDevicesRoutes],
    ['/api/iot/groups', iotGroupsRoutes],
    ['/api/iot/batch', iotBatchRoutes],
    ['/api/iot/alarms', iotAlarmsRouter],
    ['/api/iot/alarm-rules', iotAlarmRulesRouter],
    ['/api/iot/maintenance-windows', iotMaintenanceWindowsRouter],
    ['/api/iot/automations', iotAutomationsRouter],
    ['/api/iot/forward-rules', iotForwardRulesRouter],
    ['/api/iot/schedules', iotSchedulesRouter],
    ['/api/iot/whitelist', iotWhitelistRouter],
    ['/api/iot/firmwares', iotFirmwaresRouter],
    ['/api/iot/ota-tasks', iotOtaTasksRouter],
    // 设备侧接入通道（HMAC 鉴权，无管理端 token）
    ['/api/iot/ingest', ingestRoutes],
    ['/api/iot/ws', createIotWsRoute(upgradeWebSocket)],
  ],
});
