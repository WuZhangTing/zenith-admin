import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { oauthConfigs, type DirectorySyncSourceRow } from '../../db/schema';
import { httpGet, httpPost } from '../../lib/http-client';
import {
  getUsableDirectoryProvider,
  mapDirectoryProfile,
  searchDirectoryEntries,
} from './identity-providers.service';

/** 外部部门（连接器统一输出格式） */
export interface DirectoryExtDept {
  externalId: string;
  name: string;
  /** null = 挂在根节点下 */
  parentExternalId: string | null;
  sort?: number;
}

/** 外部用户（连接器统一输出格式） */
export interface DirectoryExtUser {
  externalId: string;
  username: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  /** 源侧是否在职/启用 */
  active: boolean;
  /** 归属外部部门（首个视为主部门） */
  deptExternalIds: string[];
}

export interface DirectorySnapshot {
  departments: DirectoryExtDept[];
  users: DirectoryExtUser[];
}

export interface DirectoryConnectorTestResult {
  ok: boolean;
  message: string;
  sampleUsers: Array<{ externalId: string; username: string; nickname: string }>;
}

export interface DirectoryConnector {
  fetch(): Promise<DirectorySnapshot>;
  test(): Promise<DirectoryConnectorTestResult>;
}

const LDAP_SYNC_FETCH_LIMIT = 5000;

// ─── LDAP / AD 连接器：连接与凭证复用企业身份源 ──────────────────────────────────
function createLdapConnector(source: DirectorySyncSourceRow): DirectoryConnector {
  const providerId = source.identityProviderId;
  if (!providerId) throw new HTTPException(400, { message: '同步源未绑定企业身份源' });

  async function fetchSnapshot(limit: number): Promise<DirectorySnapshot> {
    const provider = await getUsableDirectoryProvider(providerId!);
    const entries = await searchDirectoryEntries(provider, { mode: 'sync', limit });
    const users: DirectoryExtUser[] = [];
    const deptNames = new Map<string, DirectoryExtDept>();
    for (const entry of entries) {
      const { user } = mapDirectoryProfile(provider, entry);
      const deptName = user.department?.trim() || null;
      let deptExternalIds: string[] = [];
      if (deptName) {
        const externalId = `name:${deptName}`;
        if (!deptNames.has(externalId)) {
          deptNames.set(externalId, { externalId, name: deptName, parentExternalId: null });
        }
        deptExternalIds = [externalId];
      }
      users.push({
        externalId: user.subject,
        username: user.username,
        nickname: user.nickname,
        email: user.email ?? null,
        phone: user.phone ?? null,
        active: true,
        deptExternalIds,
      });
    }
    return { departments: Array.from(deptNames.values()), users };
  }

  return {
    fetch: () => fetchSnapshot(LDAP_SYNC_FETCH_LIMIT),
    async test() {
      try {
        const snapshot = await fetchSnapshot(3);
        return {
          ok: true,
          message: `连接成功，抽样 ${snapshot.users.length} 个目录用户`,
          sampleUsers: snapshot.users.slice(0, 3).map((u) => ({ externalId: u.externalId, username: u.username, nickname: u.nickname })),
        };
      } catch (err) {
        return { ok: false, message: `连接失败：${err instanceof Error ? err.message : '未知错误'}`, sampleUsers: [] };
      }
    },
  };
}

// ─── 钉钉连接器：凭证复用 OAuth 配置（appKey/appSecret = clientId/clientSecret）───
const DINGTALK_API = 'https://oapi.dingtalk.com';

const DINGTALK_ROOT_DEPT_ID = 1;

interface DingTalkTokenCache {
  token: string;
  expiresAt: number;
}

const dingTalkTokenCache = new Map<string, DingTalkTokenCache>();

interface DingTalkDeptRaw {
  dept_id: number;
  name: string;
  parent_id: number;
}

interface DingTalkUserRaw {
  userid: string;
  name: string;
  mobile?: string;
  email?: string;
  org_email?: string;
  active?: boolean;
  dept_id_list?: number[];
}

async function getDingTalkCredentials() {
  const [row] = await db.select().from(oauthConfigs).where(eq(oauthConfigs.provider, 'dingtalk')).limit(1);
  if (!row?.clientId || !row.clientSecret) {
    throw new HTTPException(400, { message: '钉钉 OAuth 配置缺失，请先在「OAuth 配置」中填写 appKey/appSecret' });
  }
  return { appKey: row.clientId, appSecret: row.clientSecret };
}

async function getDingTalkToken(): Promise<string> {
  const { appKey, appSecret } = await getDingTalkCredentials();
  const cached = dingTalkTokenCache.get(appKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const resp = await httpGet(`${DINGTALK_API}/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`, {
    timeout: 10_000,
    retries: 1,
  });
  const data = await resp.json<{ errcode?: number; errmsg?: string; access_token?: string; expires_in?: number }>();
  if (!resp.ok || data.errcode !== 0 || !data.access_token) {
    throw new HTTPException(400, { message: `钉钉获取 access_token 失败：${data.errmsg ?? `HTTP ${resp.status}`}` });
  }
  dingTalkTokenCache.set(appKey, {
    token: data.access_token,
    // 官方 7200s，提前 5 分钟过期
    expiresAt: Date.now() + ((data.expires_in ?? 7200) - 300) * 1000,
  });
  return data.access_token;
}

async function dingTalkApi<T>(token: string, path: string, body: Record<string, unknown>): Promise<T> {
  const resp = await httpPost(`${DINGTALK_API}${path}?access_token=${encodeURIComponent(token)}`, JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    timeout: 15_000,
    retries: 1,
  });
  const data = await resp.json<{ errcode?: number; errmsg?: string; result?: T }>();
  if (!resp.ok || data.errcode !== 0) {
    throw new HTTPException(400, { message: `钉钉接口 ${path} 调用失败：${data.errmsg ?? `HTTP ${resp.status}`}` });
  }
  return data.result as T;
}

async function fetchDingTalkDepartments(token: string): Promise<DirectoryExtDept[]> {
  const depts: DirectoryExtDept[] = [];
  const queue: number[] = [DINGTALK_ROOT_DEPT_ID];
  const seen = new Set<number>(queue);
  while (queue.length > 0) {
    const deptId = queue.shift()!;
    const children = await dingTalkApi<DingTalkDeptRaw[]>(token, '/topapi/v2/department/listsub', { dept_id: deptId });
    for (const child of children ?? []) {
      if (seen.has(child.dept_id)) continue;
      seen.add(child.dept_id);
      depts.push({
        externalId: String(child.dept_id),
        name: child.name,
        parentExternalId: child.parent_id === DINGTALK_ROOT_DEPT_ID ? null : String(child.parent_id),
      });
      queue.push(child.dept_id);
    }
  }
  return depts;
}

async function fetchDingTalkUsersOfDept(token: string, deptId: number): Promise<DingTalkUserRaw[]> {
  const list: DingTalkUserRaw[] = [];
  let cursor = 0;
  for (;;) {
    const result = await dingTalkApi<{ list?: DingTalkUserRaw[]; has_more?: boolean; next_cursor?: number }>(
      token,
      '/topapi/v2/user/list',
      { dept_id: deptId, cursor, size: 100 },
    );
    list.push(...(result.list ?? []));
    if (!result.has_more || result.next_cursor == null) break;
    cursor = result.next_cursor;
  }
  return list;
}

function createDingTalkConnector(): DirectoryConnector {
  async function fetchSnapshot(): Promise<DirectorySnapshot> {
    const token = await getDingTalkToken();
    const departments = await fetchDingTalkDepartments(token);
    const deptIds = [DINGTALK_ROOT_DEPT_ID, ...departments.map((d) => Number(d.externalId))];
    const userMap = new Map<string, DirectoryExtUser>();
    for (const deptId of deptIds) {
      const rawUsers = await fetchDingTalkUsersOfDept(token, deptId);
      for (const raw of rawUsers) {
        if (userMap.has(raw.userid)) continue;
        const deptExternalIds = (raw.dept_id_list ?? [deptId])
          .filter((id) => id !== DINGTALK_ROOT_DEPT_ID)
          .map((id) => String(id));
        userMap.set(raw.userid, {
          externalId: raw.userid,
          username: raw.mobile?.trim() || raw.userid,
          nickname: raw.name,
          email: raw.email?.trim() || raw.org_email?.trim() || null,
          phone: raw.mobile?.trim() || null,
          active: raw.active !== false,
          deptExternalIds,
        });
      }
    }
    return { departments, users: Array.from(userMap.values()) };
  }

  return {
    fetch: fetchSnapshot,
    async test() {
      try {
        const token = await getDingTalkToken();
        const children = await dingTalkApi<DingTalkDeptRaw[]>(token, '/topapi/v2/department/listsub', { dept_id: DINGTALK_ROOT_DEPT_ID });
        return {
          ok: true,
          message: `连接成功，根部门下有 ${children?.length ?? 0} 个子部门`,
          sampleUsers: [],
        };
      } catch (err) {
        return { ok: false, message: `连接失败：${err instanceof Error ? err.message : '未知错误'}`, sampleUsers: [] };
      }
    },
  };
}

/** 按同步源类型构建连接器 */
export function buildDirectoryConnector(source: DirectorySyncSourceRow): DirectoryConnector {
  switch (source.type) {
    case 'ldap': return createLdapConnector(source);
    case 'dingtalk': return createDingTalkConnector();
    default: throw new HTTPException(400, { message: `不支持的同步源类型：${source.type}` });
  }
}
