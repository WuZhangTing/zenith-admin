import * as z from 'zod';

export const memberRechargeSchema = z.object({
  applicationId: z.number().int().positive(),
  amount: z.number().int().positive('充值金额必须大于 0'),
  payMethod: z.enum(['wechat_native', 'wechat_jsapi', 'wechat_h5', 'alipay_page', 'alipay_wap', 'alipay_app', 'unionpay_qr']),
  memberCouponId: z.number().int().positive().optional(),
});

export type MemberRechargeInput = z.infer<typeof memberRechargeSchema>;

/** 会员端签约自动续费 */
export const memberSignRenewalSchema = z.object({
  applicationId: z.number().int().positive(),
  currency: z.literal('CNY').default('CNY'),
  planId: z.number().int().positive(),
  payMethod: z.enum(['wechat_papay', 'alipay_cycle']).default('wechat_papay'),
});

export type MemberSignRenewalInput = z.infer<typeof memberSignRenewalSchema>;

// ─── 会员中心（Member Center）────────────────────────────────────────
const memberPhoneSchema = z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的手机号码');

/** 会员注册（支持用户名/手机/邮箱多种方式，至少提供一个凭证）*/
export const memberRegisterSchema = z
  .object({
    username: z.string().min(2, '用户名至少2个字符').max(32).optional(),
    phone: memberPhoneSchema.optional(),
    email: z.email('邮箱格式不正确').optional(),
    password: z.string().min(6, '密码至少6个字符').max(64).optional(),
    smsCode: z.string().length(6, '验证码为6位').optional(),
    nickname: z.string().min(1).max(32).optional(),
    /** 邀请码（选填，注册成功后绑定邀请关系并奖励邀请人）*/
    inviteCode: z.string().min(4).max(16).optional(),
  })
  .refine((d) => !!(d.username || d.phone || d.email), { message: '请至少提供用户名、手机号或邮箱' });

/** 会员登录：password（账号+密码）或 sms（手机号+验证码）*/
export const memberLoginSchema = z
  .object({
    loginType: z.enum(['password', 'sms']).default('password'),
    account: z.string().min(1, '请输入登录账号').max(128).optional(),
    password: z.string().min(1).max(64).optional(),
    phone: memberPhoneSchema.optional(),
    smsCode: z.string().length(6).optional(),
  })
  .refine((d) => (d.loginType === 'password' ? !!d.account && !!d.password : !!d.phone && !!d.smsCode), {
    message: '登录参数不完整',
  });

/** 发送短信验证码 */
export const memberSmsCodeSchema = z.object({
  phone: memberPhoneSchema,
  scene: z.enum(['register', 'login', 'reset']).default('login'),
});

/** 会员修改资料 */
export const memberUpdateProfileSchema = z.object({
  nickname: z.string().min(1).max(32).optional(),
  avatar: z.string().max(256).nullish(),
  gender: z.string().max(20).nullable().optional(),
  birthday: z.string().max(20).nullable().optional(),
  email: z.email().nullish(),
});

/** 会员修改密码（首次设密时 oldPassword 可空）*/
export const memberChangePasswordSchema = z.object({
  oldPassword: z.string().min(6).max(64).optional(),
  newPassword: z.string().min(6, '密码至少6个字符').max(64),
});

/** 会员忘记密码（手机验证码重置）*/
export const memberResetPasswordSchema = z.object({
  phone: memberPhoneSchema,
  smsCode: z.string().length(6),
  newPassword: z.string().min(6).max(64),
});

export type MemberRegisterInput = z.infer<typeof memberRegisterSchema>;

export type MemberLoginInput = z.infer<typeof memberLoginSchema>;

export type MemberSmsCodeInput = z.infer<typeof memberSmsCodeSchema>;

export type MemberUpdateProfileInput = z.infer<typeof memberUpdateProfileSchema>;

export type MemberChangePasswordInput = z.infer<typeof memberChangePasswordSchema>;

export type MemberResetPasswordInput = z.infer<typeof memberResetPasswordSchema>;

/** 会员评论提交（昵称自动取会员资料，无需蜜罐） */
export const memberSubmitCmsCommentSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000),
  /** 回复的父评论 id（0/缺省 = 顶级评论） */
  parentId: z.coerce.number().int().min(0).optional(),
});

export type MemberSubmitCmsCommentInput = z.input<typeof memberSubmitCmsCommentSchema>;
