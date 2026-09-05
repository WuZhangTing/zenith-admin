/**
 * OAuth2 RFC 协议端点（/token、/token/introspect、/userinfo）的响应 DTO。
 * 这些端点以表单入参、按 RFC 返回顶层 JSON，不经契约 DSL；响应形状由 shared 契约模块唯一定义，
 * 此处仅按 DTO 命名别名导出供 createRoute 引用。
 */
import { oauth2IntrospectResponseSchema, oauth2TokenResponseSchema, oauth2UserInfoSchema } from '@zenith/shared/open-platform';

export const OAuth2TokenResponseDTO = oauth2TokenResponseSchema;

export const OAuth2UserInfoDTO = oauth2UserInfoSchema;

export const OAuth2IntrospectResponseDTO = oauth2IntrospectResponseSchema;
