import { and, eq, isNull } from 'drizzle-orm';
import { DRIVE_SETTING_KEYS, type DriveSettings, type DriveSettingsInput, type DriveSpaceType } from '@zenith/shared/drive';
import { db } from '../../db';
import { systemConfigs } from '../../db/schema';
import { getConfigBoolean, getConfigNumber, getConfigValue } from '../../lib/system-config';

/** 默认值与 SEED_SYSTEM_CONFIGS 保持一致 */
const DEFAULTS: DriveSettings = {
  personalQuotaGb: 10,
  departmentQuotaGb: 100,
  teamQuotaGb: 50,
  departmentSpaceAutoCreate: true,
  recycleRetentionDays: 30,
  maxVersions: 20,
  quotaWarningPercent: 90,
  externalShareEnabled: true,
  externalShareMaxDays: 30,
  externalShareRequirePassword: false,
  blockedExtensions: 'exe,bat,cmd,sh,msi,dll,scr,com,ps1,vbs',
  thumbnailEnabled: true,
  textIndexEnabled: true,
};

export async function getDriveSettings(): Promise<DriveSettings> {
  const [
    personalQuotaGb, departmentQuotaGb, teamQuotaGb, departmentSpaceAutoCreate, recycleRetentionDays, maxVersions,
    quotaWarningPercent, externalShareEnabled, externalShareMaxDays, externalShareRequirePassword, blockedExtensions,
    thumbnailEnabled, textIndexEnabled,
  ] = await Promise.all([
    getConfigNumber(DRIVE_SETTING_KEYS.personalQuotaGb, DEFAULTS.personalQuotaGb),
    getConfigNumber(DRIVE_SETTING_KEYS.departmentQuotaGb, DEFAULTS.departmentQuotaGb),
    getConfigNumber(DRIVE_SETTING_KEYS.teamQuotaGb, DEFAULTS.teamQuotaGb),
    getConfigBoolean(DRIVE_SETTING_KEYS.departmentSpaceAutoCreate, DEFAULTS.departmentSpaceAutoCreate),
    getConfigNumber(DRIVE_SETTING_KEYS.recycleRetentionDays, DEFAULTS.recycleRetentionDays),
    getConfigNumber(DRIVE_SETTING_KEYS.maxVersions, DEFAULTS.maxVersions),
    getConfigNumber(DRIVE_SETTING_KEYS.quotaWarningPercent, DEFAULTS.quotaWarningPercent),
    getConfigBoolean(DRIVE_SETTING_KEYS.externalShareEnabled, DEFAULTS.externalShareEnabled),
    getConfigNumber(DRIVE_SETTING_KEYS.externalShareMaxDays, DEFAULTS.externalShareMaxDays),
    getConfigBoolean(DRIVE_SETTING_KEYS.externalShareRequirePassword, DEFAULTS.externalShareRequirePassword),
    getConfigValue(DRIVE_SETTING_KEYS.blockedExtensions, DEFAULTS.blockedExtensions),
    getConfigBoolean(DRIVE_SETTING_KEYS.thumbnailEnabled, DEFAULTS.thumbnailEnabled),
    getConfigBoolean(DRIVE_SETTING_KEYS.textIndexEnabled, DEFAULTS.textIndexEnabled),
  ]);
  return {
    personalQuotaGb, departmentQuotaGb, teamQuotaGb, departmentSpaceAutoCreate, recycleRetentionDays, maxVersions,
    quotaWarningPercent, externalShareEnabled, externalShareMaxDays, externalShareRequirePassword, blockedExtensions,
    thumbnailEnabled, textIndexEnabled,
  };
}

const SETTING_META: Record<string, { name: string; type: 'string' | 'boolean' | 'number' }> = {
  [DRIVE_SETTING_KEYS.personalQuotaGb]: { name: '网盘-个人空间默认配额(GB)', type: 'number' },
  [DRIVE_SETTING_KEYS.departmentQuotaGb]: { name: '网盘-部门空间默认配额(GB)', type: 'number' },
  [DRIVE_SETTING_KEYS.teamQuotaGb]: { name: '网盘-协作空间默认配额(GB)', type: 'number' },
  [DRIVE_SETTING_KEYS.departmentSpaceAutoCreate]: { name: '网盘-部门空间自动创建', type: 'boolean' },
  [DRIVE_SETTING_KEYS.recycleRetentionDays]: { name: '网盘-回收站保留天数', type: 'number' },
  [DRIVE_SETTING_KEYS.maxVersions]: { name: '网盘-文件版本上限', type: 'number' },
  [DRIVE_SETTING_KEYS.quotaWarningPercent]: { name: '网盘-配额预警阈值(%)', type: 'number' },
  [DRIVE_SETTING_KEYS.externalShareEnabled]: { name: '网盘-允许外链分享', type: 'boolean' },
  [DRIVE_SETTING_KEYS.externalShareMaxDays]: { name: '网盘-外链最长有效期(天)', type: 'number' },
  [DRIVE_SETTING_KEYS.externalShareRequirePassword]: { name: '网盘-外链强制密码', type: 'boolean' },
  [DRIVE_SETTING_KEYS.blockedExtensions]: { name: '网盘-禁止上传的扩展名', type: 'string' },
  [DRIVE_SETTING_KEYS.thumbnailEnabled]: { name: '网盘-生成图片缩略图', type: 'boolean' },
  [DRIVE_SETTING_KEYS.textIndexEnabled]: { name: '网盘-文本文件全文索引', type: 'boolean' },
};

async function upsertConfig(key: string, value: string) {
  const meta = SETTING_META[key];
  const [existing] = await db.select({ id: systemConfigs.id }).from(systemConfigs)
    .where(and(eq(systemConfigs.configKey, key), isNull(systemConfigs.tenantId)))
    .limit(1);
  if (existing) {
    await db.update(systemConfigs).set({ configValue: value }).where(eq(systemConfigs.id, existing.id));
  } else {
    await db.insert(systemConfigs).values({
      configKey: key,
      configName: meta.name,
      configValue: value,
      configType: meta.type,
      description: meta.name,
      tenantId: null,
    });
  }
}

export async function updateDriveSettings(data: DriveSettingsInput): Promise<DriveSettings> {
  const entries: Array<[string, string]> = [
    [DRIVE_SETTING_KEYS.personalQuotaGb, String(data.personalQuotaGb)],
    [DRIVE_SETTING_KEYS.departmentQuotaGb, String(data.departmentQuotaGb)],
    [DRIVE_SETTING_KEYS.teamQuotaGb, String(data.teamQuotaGb)],
    [DRIVE_SETTING_KEYS.departmentSpaceAutoCreate, String(data.departmentSpaceAutoCreate)],
    [DRIVE_SETTING_KEYS.recycleRetentionDays, String(data.recycleRetentionDays)],
    [DRIVE_SETTING_KEYS.maxVersions, String(data.maxVersions)],
    [DRIVE_SETTING_KEYS.quotaWarningPercent, String(data.quotaWarningPercent)],
    [DRIVE_SETTING_KEYS.externalShareEnabled, String(data.externalShareEnabled)],
    [DRIVE_SETTING_KEYS.externalShareMaxDays, String(data.externalShareMaxDays)],
    [DRIVE_SETTING_KEYS.externalShareRequirePassword, String(data.externalShareRequirePassword)],
    [DRIVE_SETTING_KEYS.blockedExtensions, data.blockedExtensions.trim()],
    [DRIVE_SETTING_KEYS.thumbnailEnabled, String(data.thumbnailEnabled)],
    [DRIVE_SETTING_KEYS.textIndexEnabled, String(data.textIndexEnabled)],
  ];
  for (const [key, value] of entries) await upsertConfig(key, value);
  return getDriveSettings();
}

const GB = 1024 * 1024 * 1024;

/** 空间类型对应的默认配额（字节）；0 = 不限 */
export function defaultQuotaBytes(settings: DriveSettings, type: DriveSpaceType): number {
  const gb = type === 'personal' ? settings.personalQuotaGb : type === 'department' ? settings.departmentQuotaGb : settings.teamQuotaGb;
  return Math.round(gb * GB);
}

/** 生效配额：空间显式配额优先，否则按类型取系统默认 */
export function effectiveQuotaBytes(settings: DriveSettings, space: { type: DriveSpaceType; quotaBytes: number | null }): number {
  return space.quotaBytes ?? defaultQuotaBytes(settings, space.type);
}

export function blockedExtensionSet(settings: DriveSettings): Set<string> {
  return new Set(settings.blockedExtensions.split(',').map((s) => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean));
}
