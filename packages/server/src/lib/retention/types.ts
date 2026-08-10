import type { RetentionMode } from '@zenith/shared/ops';

/** 逐租户保留天数解析结果：key 为 tenant_id（null 表示平台级数据） */
export type TenantRetentionDays = Map<number | null, number>;

export interface RetentionPolicyDefinition {
  /** 策略唯一键，与目标物理表名一致 */
  key: string;
  /** 展示名 */
  title: string;
  /** 归属模块，用于后台分组展示 */
  module: string;
  /** 目标物理表名 */
  tableName: string;
  /** 裁剪依据的物理时间列 */
  timeColumn: string;
  /** 默认保留天数；0 表示默认不清理 */
  defaultDays: number;
  mode?: RetentionMode;
  /** 单批删除行数上限 */
  batchSize?: number;
  /**
   * `ageAndCap` 模式：按时间裁剪后，再按 `capColumn` 分组只保留最近 `capLimit` 行。
   * 用于运行日志这类「既限时间也限条数」的表。
   */
  capColumn?: string;
  capLimit?: number;
  /**
   * 逐租户保留策略：返回各租户的保留天数，未覆盖的租户回落到全局配置。
   * 仅在业务域自带保留设置时使用。
   */
  perTenant?: () => Promise<TenantRetentionDays>;
  /** 删除行后的副作用（如清理关联的对象存储文件） */
  onDeleted?: (deleted: number) => Promise<void>;
  description: string;
}
