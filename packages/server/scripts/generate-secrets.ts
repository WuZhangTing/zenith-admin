/**
 * 生成运行时密钥（CSPRNG），输出可直接粘贴到 packages/server/.env 或部署环境变量。
 *
 *   npm run secret:generate              # JWT_SECRET / FIELD_ENCRYPTION_KEY
 *   npm run secret:generate -- --docker  # 额外输出 docker compose 必填的 POSTGRES_PASSWORD / REDIS_PASSWORD
 *
 * - JWT_SECRET：48 字节随机 → 64 个 base64url 字符，按服务实例独立，轮换只需全员重新登录；
 * - FIELD_ENCRYPTION_KEY：32 字节随机 → 64 位 hex，按数据库共享——连同一个库的所有实例必须一致，
 *   轮换会使已入库的密文（MFA 密钥、SSH 凭据、渠道密钥等）不可读；
 * - POSTGRES_PASSWORD / REDIS_PASSWORD：24 字节随机 → 32 个 URL 安全字符，可直接拼进连接串。
 *
 * 本地开发（npm run dev）无需运行：未配置时自动使用内置开发密钥。
 */
import { generateFieldEncryptionKey, generateInfraPassword, generateJwtSecret } from '../src/lib/secrets';

const withDocker = process.argv.includes('--docker');

const lines = [
  '# 由 npm run secret:generate 生成。每个环境单独生成，不要提交到版本库。',
  '# JWT_SECRET 按服务实例独立；FIELD_ENCRYPTION_KEY 按数据库共享（连同一个库的实例必须一致）。',
  `JWT_SECRET=${generateJwtSecret()}`,
  `FIELD_ENCRYPTION_KEY=${generateFieldEncryptionKey()}`,
];

if (withDocker) {
  lines.push(
    '# docker compose 基础设施口令（仅 compose 内网可达，仍禁止弱口令）；只含 URL 安全字符，可直接拼进连接串。',
    `POSTGRES_PASSWORD=${generateInfraPassword()}`,
    `REDIS_PASSWORD=${generateInfraPassword()}`,
  );
}

process.stdout.write(`${lines.join('\n')}\n`);
