import type { ApiScope, RatePlan } from '../open-platform/types';
import { SEED_DATE } from './_base';

// ─── 开放平台：API Scope 注册表 ───────────────────────────────────────────────
export const SEED_API_SCOPES: ApiScope[] = [
  { id: 1, code: 'openid',         name: 'OpenID（身份）',   description: '确认用户身份（用户 ID）',   scopeGroup: 'user',    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 2, code: 'profile',        name: 'Profile（资料）',  description: '读取基本信息（昵称、头像）', scopeGroup: 'user',    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3, code: 'email',          name: 'Email（邮箱）',    description: '读取邮箱地址',              scopeGroup: 'user',    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 4, code: 'offline_access', name: '离线访问',         description: '允许在用户离线时续签令牌',   scopeGroup: 'user',    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 5, code: 'user:read',      name: '读取用户',         description: '读取开放平台用户资源',       scopeGroup: 'user',    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 6, code: 'data:read',      name: '读取数据',         description: '调用只读数据类接口',         scopeGroup: 'data',    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 7, code: 'data:write',     name: '写入数据',         description: '调用写入/变更类接口',        scopeGroup: 'data',    status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 8, code: 'order:read',     name: '读取订单',         description: '读取订单数据',              scopeGroup: 'order',   status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 9, code: 'cms:read',       name: '读取 CMS 内容',    description: '读取 CMS 栏目与已发布内容（Headless API）', scopeGroup: 'data', status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 10, code: 'cms:write',     name: '写入 CMS 内容',    description: '创建/更新 CMS 内容并提交审核（还需在站点「开放授权」中授权站点与栏目）', scopeGroup: 'data', status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 11, code: 'cms:publish',   name: '发布 CMS 内容',    description: '绕过审核直接发布（还需授权开启「允许直接发布」且站点开启开关）', scopeGroup: 'data', status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
];

// ─── 开放平台：限流套餐 ───────────────────────────────────────────────────────
export const SEED_RATE_PLANS: RatePlan[] = [
  { id: 1, code: 'free',       name: '免费版',   description: '默认套餐，适合接入调试',     qpsLimit: 5,   dailyQuota: 10000,    monthlyQuota: 200000,    isDefault: true,  status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 2, code: 'pro',        name: '专业版',   description: '适合中小规模生产调用',       qpsLimit: 50,  dailyQuota: 500000,   monthlyQuota: 10000000,  isDefault: false, status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3, code: 'enterprise', name: '企业版',   description: '高并发，配额不限',           qpsLimit: 500, dailyQuota: 0,        monthlyQuota: 0,         isDefault: false, status: 'enabled', createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
