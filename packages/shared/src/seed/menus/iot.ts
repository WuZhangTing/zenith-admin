import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** IoT 设备管理（18000 段） */
export const SEED_MENUS_IOT: Menu[] = [
  { id: 18000, parentId: 0, title: 'IoT 设备', name: 'IotCenter', icon: 'Cpu', type: 'directory', sort: 18, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 产品管理 ──────────────────────────────────────────────────────────────
  { id: 18010, parentId: 18000, title: '产品管理', name: 'IotProducts', path: '/iot/products', component: 'iot/IotProductsPage', icon: 'Package', type: 'menu', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18011, parentId: 18010, title: '查询', type: 'button', permission: 'iot:product:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18012, parentId: 18010, title: '新增产品', type: 'button', permission: 'iot:product:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18013, parentId: 18010, title: '编辑产品', type: 'button', permission: 'iot:product:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18014, parentId: 18010, title: '删除产品', type: 'button', permission: 'iot:product:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 设备管理 ──────────────────────────────────────────────────────────────
  { id: 18020, parentId: 18000, title: '设备管理', name: 'IotDevices', path: '/iot/devices', component: 'iot/IotDevicesPage', icon: 'HardDrive', type: 'menu', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18021, parentId: 18020, title: '查询', type: 'button', permission: 'iot:device:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18022, parentId: 18020, title: '注册设备', type: 'button', permission: 'iot:device:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18023, parentId: 18020, title: '编辑设备', type: 'button', permission: 'iot:device:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18024, parentId: 18020, title: '删除设备', type: 'button', permission: 'iot:device:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18025, parentId: 18020, title: '遥测查看', type: 'button', permission: 'iot:telemetry:view', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18026, parentId: 18020, title: '指令下发', type: 'button', permission: 'iot:command:send', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18027, parentId: 18020, title: '分组管理', type: 'button', permission: 'iot:group:manage', sort: 6, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18028, parentId: 18020, title: '批量操作', type: 'button', permission: 'iot:device:batch', sort: 7, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 告警中心 ──────────────────────────────────────────────────────────────
  { id: 18030, parentId: 18000, title: '告警中心', name: 'IotAlarms', path: '/iot/alarms', component: 'iot/IotAlarmsPage', icon: 'BellRing', type: 'menu', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18031, parentId: 18030, title: '查询', type: 'button', permission: 'iot:alarm:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18032, parentId: 18030, title: '处理告警', type: 'button', permission: 'iot:alarm:resolve', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18033, parentId: 18030, title: '新增规则', type: 'button', permission: 'iot:alarm:rule:create', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18034, parentId: 18030, title: '编辑规则', type: 'button', permission: 'iot:alarm:rule:update', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18035, parentId: 18030, title: '删除规则', type: 'button', permission: 'iot:alarm:rule:delete', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
