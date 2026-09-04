import { tenantContract, tenantPackageContract } from '@zenith/shared/identity';
import { defineRouteDomain } from '../_kit';
import apiTokensRoutes from './api-tokens';
import authRoutes from './auth';
import departmentsRoutes from './departments';
import directorySyncRoutes from './directory-sync';
import directorySyncCallbacksRoutes from './directory-sync-callbacks';
import enterpriseAuthRoutes from './enterprise-auth';
import identityProvidersRoutes from './identity-providers';
import identitySecurityRoutes from './identity-security';
import loginLogsRoutes from './login-logs';
import menusRoutes from './menus';
import oauthConfigRoutes from './oauth-config';
import oauthRoutes from './oauth';
import positionsRoutes from './positions';
import rolesRoutes from './roles';
import sessionsRoutes from './sessions';
import tenantPackagesRoutes from './tenant-packages';
import tenantsRoutes from './tenants';
import userGroupsRoutes from './user-groups';
import usersRoutes from './users';

export default defineRouteDomain({
  name: 'identity',
  mounts: () => [
    ['/api/auth', authRoutes],
    ['/api/users', usersRoutes],
    ['/api/departments', departmentsRoutes],
    ['/api/positions', positionsRoutes],
    ['/api/user-groups', userGroupsRoutes],
    ['/api/menus', menusRoutes],
    ['/api/roles', rolesRoutes],
    ['/api/login-logs', loginLogsRoutes],
    ['/api/identity-security', identitySecurityRoutes],
    ['/api/identity-providers', identityProvidersRoutes],
    ['/api/directory-sync', directorySyncRoutes],
    // 机器端点（平台回调 / SCIM）：公开路径，自带验签与 Bearer 校验
    ['/api/directory-sync', directorySyncCallbacksRoutes],
    ['/api/sessions', sessionsRoutes],
    [tenantContract.basePath, tenantsRoutes],
    [tenantPackageContract.basePath, tenantPackagesRoutes],
    ['/api/auth/oauth', oauthRoutes],
    ['/api/auth/enterprise', enterpriseAuthRoutes],
    ['/api/oauth-config', oauthConfigRoutes],
    // 个人访问令牌属于账号安全能力（入口在个人中心），归 identity 域
    ['/api/api-tokens', apiTokensRoutes],
  ],
});
