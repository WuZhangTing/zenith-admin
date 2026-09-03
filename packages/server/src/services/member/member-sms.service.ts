/**
 * 会员短信验证码服务。
 *
 * - 验证码存 Redis（key `{prefix}member:smscode:{scene}:{phone}`，TTL 5 分钟）
 * - 同号码 60 秒发送间隔限频
 * - 真实短信发送：需配置默认短信服务商且存在含 {{code}} 的启用模板；
 *   非开发模式下未配置渠道 / 发送失败直接返回错误并回滚本次验证码（不会出现「已发送」却永远收不到码）
 * - 仅开发模式（NODE_ENV=development）回传验证码（devCode）便于联调；其他任何环境都不回传，
 *   验证码明文也永不写入日志——匿名接口回传 / 落日志等于把会员账号交给知道手机号的人
 *
 * 注意：本服务为匿名接口调用（无管理员上下文），因此不复用依赖 currentUser() 的 sendSms()，
 * 而是直接走底层 sendSmsByProvider()。
 */
import crypto from 'node:crypto';
import { and, eq, ilike } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { config } from '../../config';
import redis from '../../lib/redis';
import logger from '../../lib/logger';
import { db } from '../../db';
import { smsTemplates } from '../../db/schema';
import { findDefaultSmsConfig } from '../messaging/sms-configs.service';
import { sendSmsByProvider, renderTemplate } from '../../lib/sms-sender';
import { maskPhone } from '../../lib/masking';

export type SmsScene = 'register' | 'login' | 'reset';

const { keyPrefix } = config.redis;
const CODE_PREFIX = `${keyPrefix}member:smscode:`;
const INTERVAL_PREFIX = `${keyPrefix}member:smscode-interval:`;
const ATTEMPT_PREFIX = `${keyPrefix}member:smscode-attempts:`;

/** 验证码有效期（秒）*/
const CODE_TTL = 5 * 60;
/** 同号码发送间隔（秒）*/
const SEND_INTERVAL = 60;
/** 单个验证码允许的最大校验尝试次数（超过即作废，防爆破）*/
const MAX_VERIFY_ATTEMPTS = 5;

function codeKey(phone: string, scene: SmsScene): string {
  return `${CODE_PREFIX}${scene}:${phone}`;
}

function attemptsKey(phone: string, scene: SmsScene): string {
  return `${ATTEMPT_PREFIX}${scene}:${phone}`;
}

/** 生成 6 位数字验证码 */
function genCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

type DeliveryOutcome = 'delivered' | 'not_configured' | 'failed';

/** 发送会员短信验证码 */
export async function sendMemberSmsCode(phone: string, scene: SmsScene): Promise<{ devCode?: string }> {
  const intervalKey = `${INTERVAL_PREFIX}${phone}`;
  const ttl = await redis.ttl(intervalKey);
  if (ttl > 0) {
    throw new HTTPException(429, { message: `请 ${ttl} 秒后再获取验证码` });
  }

  const code = genCode();
  await redis.set(codeKey(phone, scene), code, 'EX', CODE_TTL);
  await redis.set(intervalKey, '1', 'EX', SEND_INTERVAL);
  await redis.del(attemptsKey(phone, scene)); // 新码下发，重置校验尝试计数

  const outcome = await trySendRealSms(phone, code);
  if (outcome !== 'delivered') {
    // 明文验证码永不落日志；只记录脱敏号码 + 场景 + 结果
    logger.warn(`[MemberSms] 验证码未实际发送（${outcome}）：${maskPhone(phone)} scene=${scene}`);
    if (!config.isDevelopment) {
      // 非开发模式：不能对匿名调用方假装「已发送」。回滚本次验证码与发送间隔，允许稍后重试
      await redis.del(codeKey(phone, scene));
      await redis.del(intervalKey);
      if (outcome === 'not_configured') {
        throw new HTTPException(503, { message: '短信服务尚未配置，请联系管理员' });
      }
      throw new HTTPException(502, { message: '短信发送失败，请稍后重试' });
    }
  }

  // 仅开发模式回传验证码便于联调（无需真实短信渠道）；其他环境一律不回传
  return config.isDevelopment ? { devCode: code } : {};
}

/** 真实短信发送：需配置默认服务商 + 含 {{code}} 的启用模板 */
async function trySendRealSms(phone: string, code: string): Promise<DeliveryOutcome> {
  const smsConfig = await findDefaultSmsConfig();
  if (!smsConfig) return 'not_configured';
  const [tpl] = await db
    .select()
    .from(smsTemplates)
    .where(
      and(
        eq(smsTemplates.provider, smsConfig.provider),
        eq(smsTemplates.status, 'enabled'),
        ilike(smsTemplates.content, '%{{code}}%'),
      ),
    )
    .limit(1);
  if (!tpl) return 'not_configured';
  const variables = { code };
  const renderedContent = renderTemplate(tpl.content, variables);
  try {
    const result = await sendSmsByProvider({ config: smsConfig, template: tpl, phone, variables, renderedContent });
    return result.success ? 'delivered' : 'failed';
  } catch (err) {
    logger.warn(`[MemberSms] 短信服务商调用异常：${maskPhone(phone)}`, err);
    return 'failed';
  }
}

/** 校验会员短信验证码（成功后立即删除，防重放；错误累计到上限即作废，防爆破）*/
export async function verifyMemberSmsCode(phone: string, scene: SmsScene, code: string): Promise<boolean> {
  const key = codeKey(phone, scene);
  const stored = await redis.get(key);
  if (!stored) return false;

  const aKey = attemptsKey(phone, scene);
  const attempts = await redis.incr(aKey);
  if (attempts === 1) await redis.expire(aKey, CODE_TTL);
  if (attempts > MAX_VERIFY_ATTEMPTS) {
    // 超过尝试上限：作废验证码与计数，攻击者需重新获取（受发送频率限制）
    await redis.del(key);
    await redis.del(aKey);
    return false;
  }

  if (stored !== code) return false;

  await redis.del(key);
  await redis.del(aKey);
  return true;
}
