import type { Menu } from '../../identity/types';
import { SEED_DATE } from '../_base';

/** IoT 设备管理（18000 段） */
export const SEED_MENUS_IOT: Menu[] = [
  { id: 18000, parentId: 0, title: 'IoT 设备', name: 'IotCenter', icon: 'Cpu', type: 'directory', sort: 18, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 总览仪表盘 ────────────────────────────────────────────────────────────
  { id: 18040, parentId: 18000, title: '总览', name: 'IotDashboard', path: '/iot/dashboard', component: 'iot/IotDashboardPage', icon: 'Gauge', type: 'menu', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18041, parentId: 18040, title: '查询', type: 'button', permission: 'iot:dashboard:view', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

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
  { id: 18029, parentId: 18020, title: '导入设备', type: 'button', permission: 'iot:device:import', sort: 8, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 告警中心 ──────────────────────────────────────────────────────────────
  { id: 18030, parentId: 18000, title: '告警中心', name: 'IotAlarms', path: '/iot/alarms', component: 'iot/IotAlarmsPage', icon: 'BellRing', type: 'menu', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18031, parentId: 18030, title: '查询', type: 'button', permission: 'iot:alarm:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18032, parentId: 18030, title: '处理告警', type: 'button', permission: 'iot:alarm:resolve', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18033, parentId: 18030, title: '新增规则', type: 'button', permission: 'iot:alarm:rule:create', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18034, parentId: 18030, title: '编辑规则', type: 'button', permission: 'iot:alarm:rule:update', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18035, parentId: 18030, title: '删除规则', type: 'button', permission: 'iot:alarm:rule:delete', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 固件升级 ──────────────────────────────────────────────────────────────
  { id: 18050, parentId: 18000, title: '固件升级', name: 'IotOta', path: '/iot/ota', component: 'iot/IotOtaPage', icon: 'CloudUpload', type: 'menu', sort: 4, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18051, parentId: 18050, title: '查询', type: 'button', permission: 'iot:ota:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18052, parentId: 18050, title: '固件管理', type: 'button', permission: 'iot:ota:firmware:manage', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18053, parentId: 18050, title: '创建升级任务', type: 'button', permission: 'iot:ota:task:create', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 场景联动 ──────────────────────────────────────────────────────────────
  { id: 18060, parentId: 18000, title: '场景联动', name: 'IotAutomations', path: '/iot/automations', component: 'iot/IotAutomationsPage', icon: 'Workflow', type: 'menu', sort: 5, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18061, parentId: 18060, title: '查询', type: 'button', permission: 'iot:automation:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18062, parentId: 18060, title: '新增联动', type: 'button', permission: 'iot:automation:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18063, parentId: 18060, title: '编辑联动', type: 'button', permission: 'iot:automation:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18064, parentId: 18060, title: '删除联动', type: 'button', permission: 'iot:automation:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 数据流转 ──────────────────────────────────────────────────────────────
  { id: 18070, parentId: 18000, title: '数据流转', name: 'IotForwards', path: '/iot/forwards', component: 'iot/IotForwardsPage', icon: 'Share2', type: 'menu', sort: 6, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18071, parentId: 18070, title: '查询', type: 'button', permission: 'iot:forward:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18072, parentId: 18070, title: '新增规则', type: 'button', permission: 'iot:forward:create', sort: 1, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18073, parentId: 18070, title: '编辑规则', type: 'button', permission: 'iot:forward:update', sort: 2, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18074, parentId: 18070, title: '删除规则', type: 'button', permission: 'iot:forward:delete', sort: 3, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },

  // ─── 设备地图 ──────────────────────────────────────────────────────────────
  { id: 18080, parentId: 18000, title: '设备地图', name: 'IotMap', path: '/iot/map', component: 'iot/IotMapPage', icon: 'MapPin', type: 'menu', sort: 7, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 18081, parentId: 18080, title: '查询', type: 'button', permission: 'iot:device:list', sort: 0, status: 'enabled', visible: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
