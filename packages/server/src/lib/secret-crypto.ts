/**
 * 凭据类字段的 AES-256-GCM 加解密（TOTP 密钥、SSH 主机凭据、Workflow 订阅密钥 / 数据源 header 等）。
 *
 * 密钥来自 `config.fieldEncryptionKey`（环境变量 FIELD_ENCRYPTION_KEY，64 位 hex），与 lib/encryption.ts
 * 共用同一把「数据库密钥」——它属于数据库而非某个服务实例，连同一个库的所有实例必须一致；
 * 与会话签名密钥 JWT_SECRET 彼此独立，轮换 JWT_SECRET 不影响已入库的密文。
 *
 * 与 encryption.ts 的区别：本模块解密失败**抛出** `SecretDecryptError`（调用方必须处理，
 * 例如提示重新录入凭据），encryption.ts 则返回 null。
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class SecretDecryptError extends Error {
  constructor() {
    super('密文无法用当前 FIELD_ENCRYPTION_KEY 解密：加密时使用的密钥与当前配置不一致，请重新录入该凭据');
    this.name = 'SecretDecryptError';
  }
}

function getKey(): Buffer {
  const key = Buffer.from(config.fieldEncryptionKey, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error('FIELD_ENCRYPTION_KEY 必须是 64 位十六进制（32 字节）；运行 `npm run secret:generate` 生成');
  }
  return key;
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, 'base64url');
  if (raw.length < IV_LENGTH + TAG_LENGTH) throw new SecretDecryptError();
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new SecretDecryptError();
  }
}
