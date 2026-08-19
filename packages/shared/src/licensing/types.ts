import type {
  LicenseEdition,
  LicenseEventType,
  LicenseFeatureKey,
  LicenseStatus,
} from './constants';

// ─── License 文档（签名对象）──────────────────────────────────────────────────

/**
 * 被签名的载荷。验签流程：先对 payload 原始字节验签，通过后再 Zod 解析——
 * 绝不重新序列化后验签（JSON 键序不稳定会导致签名失配）。
 */
export interface LicensePayload {
  licenseId: string;
  /** 固定 'zenith-admin'，防止其他产品签发的文件被误用 */
  audience: string;
  /** 绑定的部署实例 ID（system_installations.installationId） */
  installationId: string;
  customerId: string;
  customerName: string;
  edition: LicenseEdition;
  features: LicenseFeatureKey[];
  limits: {
    maxUsers: number | null;
    maxTenants: number | null;
    /** 展示型元数据，无运行时强制 */
    maxNodes: number | null;
  };
  issuedAt: string;
  notBefore: string;
  expiresAt: string;
  /** 过期后的宽限截止；此前功能保持可用但持续告警 */
  graceUntil: string;
  /** 展示型元数据：可升级新版本的截止日，无运行时强制 */
  maintenanceUntil: string | null;
}

/** .zenlic 文件结构 */
export interface LicenseEnvelope {
  version: number;
  algorithm: string;
  /** 发行方公钥版本，支持轮换 */
  keyId: string;
  /** base64url 编码的 payload 原始字节 */
  payload: string;
  /** base64url 编码的 Ed25519 签名 */
  signature: string;
}

// ─── 套餐配额 ─────────────────────────────────────────────────────────────────

export interface TenantPackageQuotas {
  /** 套餐级席位上限；与 License.maxUsers、tenant.maxUsers 取最小值生效 */
  maxUsers?: number | null;
}

// ─── 视图模型 ─────────────────────────────────────────────────────────────────

/** License 状态页概览（已验签数据的投影 + 运行时状态） */
export interface LicenseInfo {
  id: number;
  licenseId: string;
  status: LicenseStatus;
  edition: LicenseEdition;
  editionLabel: string;
  customerId: string;
  customerName: string;
  features: LicenseFeatureKey[];
  limits: LicensePayload['limits'];
  issuedAt: string;
  notBefore: string;
  expiresAt: string;
  graceUntil: string;
  maintenanceUntil: string | null;
  keyId: string;
  activatedAt: string;
  lastVerifiedAt: string | null;
  invalidReason: string | null;
  replacedById: number | null;
}

/** 安装身份与运行摘要 */
export interface LicenseInstallationInfo {
  installationId: string;
  licenseEpoch: number;
  createdAt: string;
  /** 当前 LICENSE_MODE */
  mode: string;
  /** 近期活跃后端节点数（心跳统计，展示用） */
  activeNodes: number;
}

/** 有效授权快照（当前部署最终生效的功能与限额） */
export interface LicenseEffectiveState {
  mode: string;
  status: LicenseStatus | 'unlicensed';
  features: LicenseFeatureKey[];
  limits: LicensePayload['limits'] | null;
  expiresAt: string | null;
  graceUntil: string | null;
  /** 当前是否处于受限模式（required 下 License 失效） */
  restricted: boolean;
}

export interface LicenseEventItem {
  id: number;
  licenseId: number | null;
  type: LicenseEventType;
  typeLabel: string;
  detail: string | null;
  createdAt: string;
}
