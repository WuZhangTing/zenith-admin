/**
 * listConfiguredProviders / isProviderConfigured 契约：
 * 登录页只渲染这里返回的 provider，判定规则（已启用 + 凭据完整 + 企业微信另需 corpId）
 * 两个函数必须一致，且返回顺序固定为 OAUTH_PROVIDERS 的声明顺序（登录页图标顺序稳定）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('../../db', () => ({ db: { select: dbMocks.select } }));

import { isProviderConfigured, listConfiguredProviders } from './index';

type ConfigRow = {
  provider: 'github' | 'dingtalk' | 'wechat_work' | 'feishu';
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  agentId: string | null;
  corpId: string | null;
};

function row(overrides: Partial<ConfigRow> & Pick<ConfigRow, 'provider'>): ConfigRow {
  return { enabled: true, clientId: 'id', clientSecret: 'secret', agentId: null, corpId: null, ...overrides };
}

function createSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

beforeEach(() => dbMocks.select.mockReset());

describe('listConfiguredProviders', () => {
  it('只返回已启用且凭据完整的提供方，并按 OAUTH_PROVIDERS 声明顺序排列', async () => {
    dbMocks.select.mockReturnValueOnce(createSelectChain([
      row({ provider: 'feishu' }),
      row({ provider: 'github' }),
      row({ provider: 'dingtalk', enabled: false }),
      row({ provider: 'wechat_work', corpId: null }),
    ]));
    await expect(listConfiguredProviders()).resolves.toEqual(['github', 'feishu']);
  });

  it('企业微信补齐 corpId 后可用；缺 clientSecret 的不可用', async () => {
    dbMocks.select.mockReturnValueOnce(createSelectChain([
      row({ provider: 'wechat_work', agentId: 'agent', corpId: 'corp' }),
      row({ provider: 'github', clientSecret: '' }),
    ]));
    await expect(listConfiguredProviders()).resolves.toEqual(['wechat_work']);
  });

  it('一张配置都没有时返回空数组（登录页据此不渲染入口）', async () => {
    dbMocks.select.mockReturnValueOnce(createSelectChain([]));
    await expect(listConfiguredProviders()).resolves.toEqual([]);
  });
});

describe('isProviderConfigured', () => {
  it('与列表判定一致：未启用为 false，配置完整为 true，无记录为 false', async () => {
    dbMocks.select.mockReturnValueOnce(createSelectChain([row({ provider: 'github', enabled: false })]));
    await expect(isProviderConfigured('github')).resolves.toBe(false);
    dbMocks.select.mockReturnValueOnce(createSelectChain([row({ provider: 'github' })]));
    await expect(isProviderConfigured('github')).resolves.toBe(true);
    dbMocks.select.mockReturnValueOnce(createSelectChain([]));
    await expect(isProviderConfigured('feishu')).resolves.toBe(false);
  });
});
