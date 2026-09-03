/**
 * 工作流出站辅助（H6）：连接器 URL 拼装的同源约束与 URL 模板的占位值编码。
 * SSRF 防护本体在 lib/outbound-url + http-client，此处只锁定工作流域接入层的行为契约。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config', () => ({ config: { workflow: { outboundAllowedHosts: ['intranet.example'] } } }));
vi.mock('./http-client', () => ({ httpRequest: vi.fn(async () => ({ ok: true })) }));
vi.mock('./outbound-url', () => ({ assertSafeOutboundUrl: vi.fn(async (url: string) => new URL(url)) }));

import { httpRequest } from './http-client';
import { assertSafeOutboundUrl } from './outbound-url';
import { assertSafeWorkflowUrl, buildConnectorUrl, renderUrlTemplate, workflowHttp, workflowHttpGet, workflowHttpPost } from './workflow-outbound';

describe('buildConnectorUrl', () => {
  const base = 'https://api.example.com/v1/';

  it('相对路径拼到 baseUrl 后，多余斜杠归一', () => {
    expect(buildConnectorUrl(base, '/orders/1', {})).toBe('https://api.example.com/v1/orders/1');
    expect(buildConnectorUrl('https://api.example.com', 'orders', { a: '1' })).toBe('https://api.example.com/orders?a=1');
  });

  it('无 path 时原样使用 baseUrl 并追加 query', () => {
    expect(buildConnectorUrl('https://api.example.com/hook?x=1', undefined, { y: '2' })).toBe('https://api.example.com/hook?x=1&y=2');
  });

  it('与 baseUrl 同源的绝对地址允许', () => {
    expect(buildConnectorUrl(base, 'https://api.example.com/other/path', {})).toBe('https://api.example.com/other/path');
  });

  it.each([
    'https://attacker.example/steal',
    'http://api.example.com/v1/x',        // 协议不同 → 不同源
    'https://api.example.com:8443/v1/x',  // 端口不同 → 不同源
    '//attacker.example/steal',
    'ftp://api.example.com/x',
    'javascript:alert(1)',
  ])('跨源 / 非 http 的绝对路径 %s → 抛错，连接器凭据不会被带走', (path) => {
    expect(() => buildConnectorUrl(base, path, {})).toThrow(/同源/);
  });

  it('baseUrl 为空时绝对路径同样拒绝', () => {
    expect(() => buildConnectorUrl('', 'https://attacker.example/x', {})).toThrow(/同源/);
  });
});

describe('renderUrlTemplate', () => {
  const vars: Record<string, unknown> = {
    'form.id': 42,
    'form.evil': '../admin?x=1#frag',
    'form.host': 'evil.example/@',
    instanceId: 7,
    obj: { a: 1 },
    missing: undefined,
  };
  const resolve = (k: string) => vars[k];

  it('占位值百分号编码：/ ? # @ 均不能改写 URL 结构', () => {
    expect(renderUrlTemplate('https://h.example/api/{{form.id}}/detail?e={{form.evil}}', resolve))
      .toBe('https://h.example/api/42/detail?e=..%2Fadmin%3Fx%3D1%23frag');
    expect(renderUrlTemplate('https://h.example/u/{{form.host}}', resolve)).toBe('https://h.example/u/evil.example%2F%40');
  });

  it('对象序列化后编码，缺失值为空串，允许占位符两侧空白', () => {
    expect(renderUrlTemplate('https://h.example/?o={{ obj }}&m={{missing}}&i={{ instanceId }}', resolve))
      .toBe('https://h.example/?o=%7B%22a%22%3A1%7D&m=&i=7');
  });
});

describe('workflowHttp*', () => {
  it('始终开启 ssrfProtection 并带上工作流 allowlist，调用方无法关闭', async () => {
    await workflowHttp('https://h.example/x', { method: 'PUT', timeout: 5 } as never);
    expect(httpRequest).toHaveBeenLastCalledWith('https://h.example/x', expect.objectContaining({
      method: 'PUT', timeout: 5, ssrfProtection: true, ssrfAllowlist: ['intranet.example'],
    }));

    await workflowHttpGet('https://h.example/g');
    expect(httpRequest).toHaveBeenLastCalledWith('https://h.example/g', expect.objectContaining({ method: 'GET', ssrfProtection: true }));

    await workflowHttpPost('https://h.example/p', { a: 1 });
    expect(httpRequest).toHaveBeenLastCalledWith('https://h.example/p', expect.objectContaining({ method: 'POST', body: { a: 1 }, ssrfProtection: true }));
  });

  it('assertSafeWorkflowUrl 透传 allowlist', async () => {
    await assertSafeWorkflowUrl('https://h.example/x');
    expect(assertSafeOutboundUrl).toHaveBeenCalledWith('https://h.example/x', ['intranet.example']);
  });
});
