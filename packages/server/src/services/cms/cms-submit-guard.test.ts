/**
 * CMS 公开提交名单守卫单测（反滥用行为关键）。
 *
 * 覆盖要点：
 *  1. 黑名单命中 → 403 且不再查灰名单（短路）
 *  2. 灰名单命中 → 放行 watch=true
 *  3. 双未命中/名单缺失 → 放行 watch=false
 *  4. 主体全空 → 直接放行且不发起求值
 *
 * Mock 策略：rules-runtime decide 全 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../platform/rules-runtime.service', () => ({
  decide: vi.fn(),
}));

import { decide } from '../platform/rules-runtime.service';
import { ensureCmsSubmitAllowed } from './cms-submit-guard';

const decideMock = vi.mocked(decide);
const miss = (key: string) => ({ matched: false, outputs: {}, ref: { kind: 'list' as const, key, version: null }, reason: 'not_found' as const });
const hit = (key: string) => ({ matched: true, outputs: { hit: true }, ref: { kind: 'list' as const, key, version: null } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureCmsSubmitAllowed', () => {
  it('黑名单命中 → 403，且短路不查灰名单', async () => {
    decideMock.mockResolvedValueOnce(hit('risk_blacklist'));
    await expect(ensureCmsSubmitAllowed(['198.51.100.23'], 'cms:comment:1'))
      .rejects.toMatchObject({ status: 403 });
    expect(decideMock).toHaveBeenCalledTimes(1);
    expect(decideMock).toHaveBeenCalledWith(
      { kind: 'list', key: 'risk_blacklist' },
      {},
      expect.objectContaining({ caller: 'cms.submit', subjects: ['198.51.100.23'], bizRef: 'cms:comment:1' }),
    );
  });

  it('灰名单命中 → 放行 watch=true', async () => {
    decideMock.mockResolvedValueOnce(miss('risk_blacklist')).mockResolvedValueOnce(hit('cms_watchlist'));
    await expect(ensureCmsSubmitAllowed(['203.0.113.66'], 'cms:comment:1')).resolves.toEqual({ watch: true });
  });

  it('双未命中 → 放行 watch=false', async () => {
    decideMock.mockResolvedValueOnce(miss('risk_blacklist')).mockResolvedValueOnce(miss('cms_watchlist'));
    await expect(ensureCmsSubmitAllowed(['1.2.3.4', '42'], 'cms:form:9')).resolves.toEqual({ watch: false });
  });

  it('主体全空 → 直接放行且不发起求值', async () => {
    await expect(ensureCmsSubmitAllowed([null, undefined, '  '], 'cms:comment:1')).resolves.toEqual({ watch: false });
    expect(decideMock).not.toHaveBeenCalled();
  });
});
