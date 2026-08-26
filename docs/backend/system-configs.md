# 系统内置配置

系统配置表为 `system_configs`，管理运行时开关、密码策略、上传限制、水印、AI 配额等轻量配置。种子数据位于 `packages/shared/src/seed/platform.ts`。

## 数据模型

| 字段 | 说明 |
| --- | --- |
| `config_key` | 配置键，支持字母、数字、下划线、点和冒号 |
| `config_name` | 展示名称 |
| `config_value` | 字符串存储，最长 4096 |
| `config_type` | `string`、`number`、`boolean`、`json` |
| `description` | 描述 |
| `tenant_id` | 可选租户归属 |

唯一约束为 `(tenant_id, config_key)`。列表与详情接口使用租户条件过滤；公开读取接口按 key 查询首条记录，不做租户过滤。

## API

路由挂载在 `/api/system-configs`：

| 方法 | 路径 | 鉴权 / 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/public/{key}` | 无 | 公开读取单项配置 |
| `GET` | `/password-policy` | 无 | 获取密码策略 |
| `GET` | `/` | 管理员 | 分页查询，支持 `keyword`、`configType`、`keys` |
| `GET` | `/{id}` | `system:config:list` | 配置详情 |
| `POST` | `/` | `system:config:create` | 新增配置，记录审计 |
| `PUT` | `/{id}` | `system:config:update` | 更新配置，记录审计 |
| `DELETE` | `/{id}` | `system:config:delete` | 删除配置，记录审计 |

`keys` 参数为逗号分隔的 `configKey` 列表，传入后忽略分页并精确批量查询。

## 读取工具

服务端配置读取工具位于 `packages/server/src/lib/system-config.ts`：

- `getConfigValue(key, defaultValue?)`
- `getConfigBoolean(key, defaultValue?)`
- `getConfigNumber(key, defaultValue?)`

读取结果直接查询数据库；没有统一缓存层。

## 种子配置

`SEED_SYSTEM_CONFIGS` 包含 40 项内置配置：

| 配置键 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `captcha_enabled` | boolean | `false` | 登录验证码 |
| `site_name` | string | `Zenith Admin` | 站点名称 |
| `user_default_password` | string | `123456` | 用户默认密码 |
| `login_max_attempts` | number | `10` | 登录失败次数上限 |
| `login_lock_duration_minutes` | number | `30` | 账号锁定时长 |
| `password_min_length` | number | `6` | 密码最小长度 |
| `password_require_uppercase` | boolean | `false` | 密码需含大写字母 |
| `password_require_special_char` | boolean | `false` | 密码需含特殊字符 |
| `password_expiry_enabled` | boolean | `false` | 密码过期重置 |
| `password_expiry_days` | number | `90` | 密码过期天数 |
| `allow_registration` | boolean | `false` | 开放用户注册 |
| `forgot_password_enabled` | boolean | `false` | 忘记密码重置 |
| `watermark_enabled` | boolean | `false` | 页面水印 |
| `watermark_content` | string | 空 | 水印文本 |
| `watermark_font_size` | number | `14` | 水印字号 |
| `watermark_opacity` | number | `15` | 水印透明度 |
| `quick_chat_enabled` | boolean | `false` | 快捷聊天按钮 |
| `file_upload_validate_type` | boolean | `true` | 上传文件类型校验 |
| `file_upload_allowed_types` | string | MIME 列表 | 允许上传类型 |
| `file_upload_max_size_mb` | number | `0` | 文件上传大小上限，0 表示不限制 |
| `terminal_recording_enabled` | boolean | `false` | 终端录屏 |
| `terminal_recording_retain_days` | number | `30` | 终端录屏保留天数 |
| `terminal_recording_max_size_mb` | number | `500` | 终端录屏容量上限 |
| `terminal_upload_max_size_mb` | number | `200` | 终端上传大小上限 |
| `mfa_enabled` | boolean | `false` | MFA 多因素认证 |
| `mfa_mode` | string | `off` | MFA 模式 |
| `mfa_remember_device_days` | number | `30` | 可信设备免 MFA 天数 |
| `login_risk_enabled` | boolean | `false` | 登录风险策略 |
| `login_risk_new_device_action` | string | `allow` | 新设备登录动作 |
| `member_point_expire_days` | number | `0` | 会员积分过期天数 |
| `member_birthday_points` | number | `0` | 会员生日礼积分 |
| `member_birthday_coupon_id` | number | `0` | 会员生日礼优惠券 |
| `member_invite_reward_points` | number | `0` | 邀请奖励积分 |
| `feedback_entry_enabled` | boolean | `false` | 意见反馈入口 |
| `captcha_complexity` | string | `medium` | 验证码复杂度 |
| `ai_daily_token_quota` | number | `0` | AI 每日 Token 配额 |
| `ai_content_filter_enabled` | boolean | `false` | AI 敏感词过滤 |
| `ai_embedding_model` | string | 空 | 知识库向量模型 |
| `ai_image_model` | string | 空 | 图片生成模型 |
| `rule_publish_approval` | boolean | `false` | 决策表发布审批 |

## 运行时使用但不在种子中的键

IP 访问控制中间件读取以下配置键。它们可通过配置管理接口创建和维护：

- `ip_whitelist_enabled`
- `ip_whitelist`
- `ip_blacklist_enabled`
- `ip_blacklist`

## 注意事项

- 多租户开关来自环境变量 `MULTI_TENANT_MODE`，不是系统配置。
- 密码策略接口组合读取密码相关配置。
- 新增公开配置前需评估敏感性，因为 `/public/{key}` 无鉴权。

