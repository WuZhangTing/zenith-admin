import { Icon } from '@iconify/react';
import type { OAuthProviderType } from '@zenith/shared/identity';

/** 各提供方的 iconify 图标；钉钉 / 企业微信的字形在视框内偏小，放大一档与其他图标视觉等重。文案统一取 shared 的 OAUTH_PROVIDER_LABELS */
const ICONS: Record<OAuthProviderType, { icon: string; scale?: number }> = {
  github: { icon: 'simple-icons:github' },
  dingtalk: { icon: 'ant-design:dingtalk-outlined', scale: 1.1 },
  wechat_work: { icon: 'ant-design:wechat-work-filled', scale: 1.1 },
  feishu: { icon: 'icon-park-outline:lark' },
};

export function OAuthProviderIcon({ provider, size = 16 }: Readonly<{ provider: OAuthProviderType; size?: number }>) {
  const { icon, scale = 1 } = ICONS[provider];
  const px = Math.round(size * scale);
  return <Icon icon={icon} width={px} height={px} />;
}
