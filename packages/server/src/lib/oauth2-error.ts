/**
 * OAuth2 协议错误（RFC 6749 §5.2 / RFC 7009 / RFC 7662）。
 *
 * 协议端点（/token、/token/revoke、/token/introspect）面向第三方 OAuth2 客户端库，
 * 必须返回 `{ error, error_description }` 而非本系统的 `{ code, message, data }` 业务包装——
 * 标准客户端库只认前者，套上业务包装会让对端无法区分 invalid_grant 与 invalid_client，
 * 进而无法正确触发「重新授权」还是「换密钥」的恢复动作。
 *
 * 由 app.ts 的全局 onError 统一序列化。
 */
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** RFC 6749 §5.2 + RFC 6750 定义的错误码 */
export type OAuth2ErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'invalid_token'
  | 'server_error'
  | 'temporarily_unavailable';

/**
 * 状态码映射。
 *
 * RFC 6749 §5.2 只在客户端通过 `Authorization` 请求头认证时要求 401；本平台的令牌端点
 * 采用 body 传 client_id / client_secret（form-urlencoded），规范明确允许返回 400。
 * 选 400 还能避免 401 触发前端通用的「登录态失效」处理链路。
 * invalid_token 属于 RFC 6750 的受保护资源语义，保持 401。
 */
const STATUS_BY_CODE: Partial<Record<OAuth2ErrorCode, ContentfulStatusCode>> = {
  invalid_token: 401,
  server_error: 500,
  temporarily_unavailable: 503,
};

export class OAuth2Error extends HTTPException {
  readonly oauthError: OAuth2ErrorCode;
  readonly oauthErrorDescription?: string;

  constructor(error: OAuth2ErrorCode, description?: string) {
    const status = STATUS_BY_CODE[error] ?? 400;
    // message 同时保留可读文案，便于日志与非协议调用方排查
    super(status, { message: description ? `${error}: ${description}` : error });
    this.oauthError = error;
    this.oauthErrorDescription = description;
  }
}

/** 构造 RFC 6749 错误响应体 */
export function oauth2ErrorBody(err: OAuth2Error): { error: string; error_description?: string } {
  return err.oauthErrorDescription
    ? { error: err.oauthError, error_description: err.oauthErrorDescription }
    : { error: err.oauthError };
}
