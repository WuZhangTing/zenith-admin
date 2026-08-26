/**
 * CMS 公开提交名单守卫（评论 / 自定义表单共用），排在限流、蜜罐、敏感词之后的第三层防线。
 *
 * 语义分层（全部走规则中心统一门面 decide，名单缺失/禁用/异常按未命中放行，不阻断正常提交）：
 * - risk_blacklist（黑名单，与会员认证风控共用平台级名单）：命中 → 403 拒绝，垃圾不入审核队列；
 * - cms_watchlist（灰名单，约定 key）：命中 → 放行但返回 watch=true，评论落 risk_flag 供审核员参考。
 */
import { HTTPException } from 'hono/http-exception';
import { decide } from '../platform/rules-runtime.service';

export interface CmsSubmitGuardResult {
  /** 命中观察灰名单：放行但建议审核侧标注 */
  watch: boolean;
}

/** 主体标识集合：IP + 会员 ID + 表单中的联系方式（email/phone），空值自动剔除 */
export async function ensureCmsSubmitAllowed(subjects: Array<string | null | undefined>, bizRef: string): Promise<CmsSubmitGuardResult> {
  const values = [...new Set(subjects.filter((s): s is string => !!s?.trim()))];
  if (values.length === 0) return { watch: false };
  const blocked = await decide({ kind: 'list', key: 'risk_blacklist' }, {}, { caller: 'cms.submit', tenantId: null, subjects: values, bizRef });
  if (blocked.matched) {
    throw new HTTPException(403, { message: '提交被拒绝：当前来源存在风险，请联系站点管理员' });
  }
  const watched = await decide({ kind: 'list', key: 'cms_watchlist' }, {}, { caller: 'cms.submit', tenantId: null, subjects: values, bizRef });
  return { watch: watched.matched };
}
