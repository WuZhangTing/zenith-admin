/**
 * 生成运行时密钥（CSPRNG），输出可直接粘贴到 packages/server/.env 或部署环境变量的两行。
 *
 *   npm run secret:generate
 *
 * - JWT_SECRET：48 字节随机 → 64 个 base64url 字符，按服务实例独立，轮换只需全员重新登录；
 * - FIELD_ENCRYPTION_KEY：32 字节随机 → 64 位 hex，按数据库共享——连同一个库的所有实例必须一致，
 *   轮换会使已入库的密文（MFA 密钥、SSH 凭据、渠道密钥等）不可读。
 *
 * 本地开发（npm run dev）无需运行：未配置时自动使用内置开发密钥。
 */
import { generateFieldEncryptionKey, generateJwtSecret } from '../src/lib/secrets';

const lines = [
  '# 由 npm run secret:generate 生成。每个环境单独生成，不要提交到版本库。',
  '# JWT_SECRET 按服务实例独立；FIELD_ENCRYPTION_KEY 按数据库共享（连同一个库的实例必须一致）。',
  `JWT_SECRET=${generateJwtSecret()}`,
  `FIELD_ENCRYPTION_KEY=${generateFieldEncryptionKey()}`,
];

process.stdout.write(`${lines.join('\n')}\n`);
