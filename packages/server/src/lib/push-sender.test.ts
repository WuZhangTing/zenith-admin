/**
 * 极光推送发送适配的回归测试。
 *
 * 锁定三件事:
 * 1. 超过 1000 个 registrationId 必须分批调用(极光单次上限);
 * 2. 1003(点名单个非法 RID)/1011(整批目标无效)要能提取出待清理的 registrationId,
 *    其他错误码(如 1004 鉴权失败)不得误伤设备绑定;
 * 3. 凭证经 Basic 头传输,请求日志必须关闭(httpLog off)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpPostMock = vi.fn();
vi.mock('./http-client', () => ({ httpPost: (...args: unknown[]) => httpPostMock(...args) }));

import { sendPushByProvider } from './push-sender';
import type { PushConfigRow } from '../db/schema';

const config = {
  id: 1,
  appId: 2,
  provider: 'jpush',
  appKey: 'ak',
  masterSecret: 'ms',
  apnsProduction: false,
} as PushConfigRow;

function jpushResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  httpPostMock.mockReset();
});

describe('sendPushByProvider(jpush)', () => {
  it('空设备列表直接失败,不发起请求', async () => {
    const result = await sendPushByProvider({ config, registrationIds: [], title: 't', content: 'c' });
    expect(result.success).toBe(false);
    expect(httpPostMock).not.toHaveBeenCalled();
  });

  it('超过 1000 个 RID 按批拆分,msgId 取首批', async () => {
    httpPostMock
      .mockResolvedValueOnce(jpushResponse({ msg_id: 'first' }))
      .mockResolvedValueOnce(jpushResponse({ msg_id: 'second' }));
    const rids = Array.from({ length: 1001 }, (_, i) => `rid-${i}`);
    const result = await sendPushByProvider({ config, registrationIds: rids, title: 't', content: 'c' });
    expect(result).toEqual({ success: true, msgId: 'first' });
    expect(httpPostMock).toHaveBeenCalledTimes(2);
    const firstBody = httpPostMock.mock.calls[0][1] as { audience: { registration_id: string[] } };
    const secondBody = httpPostMock.mock.calls[1][1] as { audience: { registration_id: string[] } };
    expect(firstBody.audience.registration_id).toHaveLength(1000);
    expect(secondBody.audience.registration_id).toEqual(['rid-1000']);
  });

  it('1003 从报文中点名的非法 RID 进入 invalidRegistrationIds', async () => {
    httpPostMock.mockResolvedValueOnce(jpushResponse(
      { error: { code: 1003, message: 'The registration_id rid-bad is invalid!' } },
      false, 400,
    ));
    const result = await sendPushByProvider({
      config, registrationIds: ['rid-good', 'rid-bad'], title: 't', content: 'c',
    });
    expect(result.success).toBe(false);
    expect(result.invalidRegistrationIds).toEqual(['rid-bad']);
  });

  it('1011 整批 RID 视为无效', async () => {
    httpPostMock.mockResolvedValueOnce(jpushResponse(
      { error: { code: 1011, message: 'cannot find user by this audience' } },
      false, 400,
    ));
    const result = await sendPushByProvider({
      config, registrationIds: ['a', 'b'], title: 't', content: 'c',
    });
    expect(result.success).toBe(false);
    expect(result.invalidRegistrationIds).toEqual(['a', 'b']);
  });

  it('鉴权失败(1004)不误伤设备绑定', async () => {
    httpPostMock.mockResolvedValueOnce(jpushResponse(
      { error: { code: 1004, message: 'Authen failed' } },
      false, 401,
    ));
    const result = await sendPushByProvider({
      config, registrationIds: ['a'], title: 't', content: 'c',
    });
    expect(result.success).toBe(false);
    expect(result.errorMsg).toContain('1004');
    expect(result.invalidRegistrationIds).toEqual([]);
  });

  it('请求关闭 http 日志,凭证不落盘', async () => {
    httpPostMock.mockResolvedValueOnce(jpushResponse({ msg_id: 1 }));
    await sendPushByProvider({ config, registrationIds: ['a'], title: 't', content: 'c' });
    const options = httpPostMock.mock.calls[0][2] as { httpLog?: { level: string } };
    expect(options.httpLog?.level).toBe('off');
  });
});
