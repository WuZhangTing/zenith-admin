import type { MfaLoginChallenge } from '@zenith/shared/identity';

/**
 * 企业 SSO（OIDC / SAML / LDAP）回调拿到 MFA 挑战后，跳回登录页复用同一套验证表单时
 * 随 `location.state` 交接的数据。
 */
export interface MfaHandoffState {
  mfaChallenge: MfaLoginChallenge;
  redirectTo?: string | null;
}

/** 从 `location.state` 安全读取交接数据（历史栈里的任意对象都可能落到这里，逐字段校验） */
export function readMfaHandoff(state: unknown): MfaHandoffState | null {
  if (!state || typeof state !== 'object') return null;
  const challenge = (state as Partial<MfaHandoffState>).mfaChallenge;
  if (!challenge || typeof challenge !== 'object' || challenge.mfaRequired !== true || typeof challenge.challengeId !== 'string') {
    return null;
  }
  return { mfaChallenge: challenge, redirectTo: (state as Partial<MfaHandoffState>).redirectTo ?? null };
}
