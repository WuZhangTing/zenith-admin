// ─── 支付方式配置（支付中心 · B 档）─────────────────────────────────────────────
export interface SeedPaymentMethodConfig {
  id: number;
  method: string;
  channel: string;
  label: string;
  icon: string | null;
  enabled: boolean;
  sort: number;
}

export const SEED_PAYMENT_METHOD_CONFIGS: SeedPaymentMethodConfig[] = [
  { id: 1, method: 'wechat_native', channel: 'wechat', label: '微信扫码', icon: 'QrCode', enabled: true, sort: 1 },
  { id: 2, method: 'wechat_jsapi', channel: 'wechat', label: '微信 JSAPI', icon: 'MessageCircle', enabled: true, sort: 2 },
  { id: 3, method: 'wechat_h5', channel: 'wechat', label: '微信 H5', icon: 'Smartphone', enabled: true, sort: 3 },
  { id: 4, method: 'alipay_page', channel: 'alipay', label: '支付宝电脑网站', icon: 'Monitor', enabled: true, sort: 4 },
  { id: 5, method: 'alipay_wap', channel: 'alipay', label: '支付宝手机网站', icon: 'Smartphone', enabled: true, sort: 5 },
  { id: 6, method: 'alipay_app', channel: 'alipay', label: '支付宝 APP', icon: 'AppWindow', enabled: true, sort: 6 },
  { id: 7, method: 'unionpay_qr', channel: 'unionpay', label: '云闪付扫码', icon: 'QrCode', enabled: true, sort: 7 },
  // 签约代扣方式（服务端发起，非收银台可选项，默认停用展示）
  { id: 8, method: 'wechat_papay', channel: 'wechat', label: '微信委托代扣', icon: 'Repeat', enabled: false, sort: 8 },
  { id: 9, method: 'alipay_cycle', channel: 'alipay', label: '支付宝周期扣款', icon: 'Repeat', enabled: false, sort: 9 },
  // 预授权转支付（服务端发起，非收银台可选项，默认停用展示）
  { id: 10, method: 'wechat_preauth', channel: 'wechat', label: '微信预授权转支付', icon: 'Snowflake', enabled: false, sort: 10 },
  { id: 11, method: 'alipay_preauth', channel: 'alipay', label: '支付宝预授权转支付', icon: 'Snowflake', enabled: false, sort: 11 },
];

// ─── 扣款计划（支付中心 · 签约代扣）────────────────────────────────────────────
export interface SeedPaymentDeductPlan {
  id: number;
  name: string;
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  customDays: number | null;
  amount: number;
  maxRetries: number;
  status: 'enabled' | 'disabled';
  remark: string | null;
}

export const SEED_PAYMENT_DEDUCT_PLANS: SeedPaymentDeductPlan[] = [
  { id: 1, name: '连续包月 VIP', period: 'monthly', customDays: null, amount: 1500, maxRetries: 3, status: 'enabled', remark: '每月自动续费 15 元' },
  { id: 2, name: '连续包周 VIP', period: 'weekly', customDays: null, amount: 500, maxRetries: 3, status: 'enabled', remark: '每周自动续费 5 元' },
  { id: 3, name: '90 天畅享卡', period: 'custom', customDays: 90, amount: 3900, maxRetries: 3, status: 'enabled', remark: '每 90 天自动续费 39 元' },
];
