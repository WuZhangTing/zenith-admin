# 系统配置

`system_configs` 表存储运行时可调的键值配置，管理端「系统设置」页面维护，后端通过 `src/lib/system-config.ts` 的辅助函数读取。种子数据定义在 `packages/shared/src/seed/platform.ts` 的 `SEED_SYSTEM_CONFIGS`。

## 数据模型

| 字段 | 说明 |
| --- | --- |
| `configKey` | 配置键（租户内唯一） |
| `configValue` | 字符串存储的配置值 |
| `configType` | `string` / `number` / `boolean`（前端渲染控件用） |
| `description` | 配置说明 |
| `tenantId` | 归属租户；`NULL` = 平台级默认值 |

## 读取辅助函数

```ts
import { getConfigValue, getConfigNumber, getConfigBoolean } from '../lib/system-config';

const siteName = await getConfigValue('site_name');          // string | null
const maxAttempts = await getConfigNumber('login_max_attempts', 10); // 带默认值
const captchaOn = await getConfigBoolean('captcha_enabled'); // 'true' 或 '1' 视为 true
```

**租户回退**：多租户开启时先查当前租户的配置值，未配置则回退到平台级（`tenantId IS NULL`）的值——租户可以覆盖平台默认，未覆盖时继承。

## API 端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/system-configs` | 分页列表 |
| GET | `/api/system-configs/{id}` | 详情 |
| POST | `/api/system-configs` | 新增 |
| PUT | `/api/system-configs/{id}` | 更新 |
| DELETE | `/api/system-configs/{id}` | 删除 |
| GET | `/api/system-configs/public/{key}` | **公开**读取单个配置（登录页等未认证场景用，如 `captcha_enabled`、`site_name`） |
| GET | `/api/system-configs/password-policy` | **公开**读取密码策略聚合（前端表单校验提示） |

## 内置配置清单

种子数据内置 43 项，按用途分组：

### 站点与登录安全

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `site_name` | `Zenith Admin` | 站点名称 |
| `captcha_enabled` | `false` | 登录验证码开关 |
| `captcha_complexity` | `medium` | 验证码复杂度：`low` / `medium` / `high` |
| `user_default_password` | `123456` | 新增用户默认密码 |
| `login_max_attempts` | `10` | 登录失败上限，超出锁定账号 |
| `login_lock_duration_minutes` | `30` | 账号锁定时长（分钟） |
| `allow_registration` | `false` | 开放注册 |
| `forgot_password_enabled` | `false` | 忘记密码 / 邮件重置 |

### 密码策略

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `password_min_length` | `6` | 最小长度 |
| `password_require_uppercase` | `false` | 必须含大写字母 |
| `password_require_special_char` | `false` | 必须含特殊字符 |
| `password_expiry_enabled` | `false` | 密码过期强制重置 |
| `password_expiry_days` | `90` | 过期天数 |

### MFA 与登录风险

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `mfa_enabled` | `false` | MFA 多因素认证总开关 |
| `mfa_mode` | `off` | `off` / `optional` / `required` |
| `mfa_remember_device_days` | `30` | 可信设备免 MFA 天数 |
| `login_risk_enabled` | `false` | 登录风险策略 |
| `login_risk_new_device_action` | `allow` | 新设备动作：`allow` / `challenge` |

### 文件上传

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `file_upload_validate_type` | `true` | 基于 magic bytes 校验真实文件类型 |
| `file_upload_allowed_types` | `image/*,video/*,...` | 允许的 MIME 类型（逗号分隔，支持通配符；`*/*` 放开全部） |
| `file_upload_max_size_mb` | `0` | 单文件大小上限（MB），0 = 不限制，含分片上传 |
| `upload_session_ttl_hours` | `24` | 分片上传会话保留时长，超时未完成由定时任务清理 |

### 界面与体验

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `watermark_enabled` | `false` | 页面水印 |
| `watermark_content` | 空 | 水印文本，留空显示当前用户名 |
| `watermark_font_size` | `14` | 字号（px） |
| `watermark_opacity` | `15` | 透明度（1-100） |
| `quick_chat_enabled` | `false` | 快捷聊天按钮全局开关 |
| `feedback_entry_enabled` | `false` | 意见反馈入口 |

### Web 终端

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `terminal_recording_enabled` | `false` | 终端录屏 |
| `terminal_recording_retain_days` | `30` | 录屏保留天数（0 = 不按天清理） |
| `terminal_recording_max_size_mb` | `500` | 录屏总容量上限（0 = 不限制） |

### AI

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `ai_allow_user_custom_key` | `false` | 允许用户配置自己的 AI API Key |
| `ai_daily_token_quota` | `0` | 每用户每日 token 配额（0 = 不限制） |
| `ai_content_filter_enabled` | `false` | 输入侧敏感词过滤（词库在字典「AI 敏感词」） |
| `ai_embedding_model` | 空 | 知识库 embedding 模型；留空退化为关键词检索 |
| `ai_image_model` | 空 | 图片生成模型；留空关闭 generate_image 工具 |

### 会员中心

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `member_point_expire_days` | `0` | 积分不活跃过期天数（0 = 永不过期） |
| `member_login_log_retention_days` | `180` | 会员登录日志保留天数（0 = 不清理） |
| `member_birthday_points` | `0` | 生日礼积分（0 = 不发放） |
| `member_birthday_coupon_id` | `0` | 生日礼优惠券模板 ID（0 = 不发放） |
| `member_invite_reward_points` | `0` | 邀请奖励积分（0 = 不奖励） |

### 其他

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `rule_publish_approval` | `false` | 决策表发布审批（四眼原则） |
| `cms_ad_event_retention_days` | `180` | CMS 广告事件明细保留天数（0 = 不自动清理） |

## 新增配置项

1. 在 `packages/shared/src/seed/platform.ts` 的 `SEED_SYSTEM_CONFIGS` 追加条目（id 递增），供 DB seed 与 MSW mock 共用
2. 业务代码用 `getConfigValue` / `getConfigNumber` / `getConfigBoolean` 读取并给定合理默认值——配置缺失时代码不应崩溃
3. 需要未登录访问的键（如登录页开关），前端走 `GET /api/system-configs/public/{key}`

> 环境变量与系统配置的分工：连接信息、密钥、部署形态（Redis、数据库、代理、日志级别）用环境变量；业务运行时可调项（开关、阈值、文案）用系统配置。
