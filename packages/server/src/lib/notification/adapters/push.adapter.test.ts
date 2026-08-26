/**
 * 推送渠道适配器的分组投递回归测试。
 *
 * 锁定凭证按应用绑定后的核心语义:
 * 1. 寻址阶段过滤「所属应用没有启用凭证」的设备,全部无凭证 → 不可达(null);
 * 2. address 编码 `appId:registrationId`,投递按应用分组、各取各的凭证;
 * 3. 部分应用组失败**不抛错**(抛错会触发 outbox 重投,已成功组被重复推送),
 *    全部失败才按渠道失败上报;
 * 4. 供应商点名的无效 RID 触发设备绑定清理。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientDeviceRow, PushConfigRow } from '../../../db/schema';
import type { DeliveryContext } from '../types';

const insertReturning = vi.fn(async () => [{ id: 99 }]);
vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: insertReturning })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
  },
}));

const findPushableDevicesMock = vi.fn();
const clearInvalidMock = vi.fn(async () => undefined);
vi.mock('../../../services/ops/client-devices.service', () => ({
  findPushableDevices: (...args: unknown[]) => findPushableDevicesMock(...args),
  clearInvalidPushRegistrations: (...args: unknown[]) => clearInvalidMock(...args),
}));

const findConfigsMock = vi.fn();
vi.mock('../../../services/messaging/push-configs.service', () => ({
  findEnabledPushConfigsByAppIds: (...args: unknown[]) => findConfigsMock(...args),
}));

const sendPushMock = vi.fn();
vi.mock('../../push-sender', () => ({
  sendPushByProvider: (...args: unknown[]) => sendPushMock(...args),
}));

import { pushAdapter } from './push.adapter';

function device(appId: number, rid: string): ClientDeviceRow {
  return { appId, pushRegistrationId: rid } as ClientDeviceRow;
}

function configRow(appId: number): PushConfigRow {
  return { id: appId * 10, appId, provider: 'jpush' } as PushConfigRow;
}

function ctx(address: string): DeliveryContext {
  return {
    eventKey: 'ops.error.alert',
    event: {} as DeliveryContext['event'],
    target: { recipient: { type: 'user', id: 1 }, address, subjectId: 1 },
    title: '标题',
    content: '内容',
    vars: {},
    link: null,
    tenantId: null,
    dedupeKey: null,
    channelLocked: false,
    options: null,
  };
}

beforeEach(() => {
  findPushableDevicesMock.mockReset();
  findConfigsMock.mockReset();
  sendPushMock.mockReset();
  clearInvalidMock.mockClear();
});

describe('resolveAddress', () => {
  it('external 收件人恒不可达', async () => {
    const address = await pushAdapter.resolveAddress({ type: 'external', channel: 'push', address: 'x' }, null);
    expect(address).toBeNull();
  });

  it('过滤所属应用无启用凭证的设备,全部无凭证 → null', async () => {
    findPushableDevicesMock.mockResolvedValue([device(1, 'rid-desk')]);
    findConfigsMock.mockResolvedValue(new Map());
    expect(await pushAdapter.resolveAddress({ type: 'user', id: 1 }, null)).toBeNull();
  });

  it('address 编码 appId:registrationId,只保留有凭证的应用', async () => {
    findPushableDevicesMock.mockResolvedValue([device(1, 'rid-desk'), device(2, 'rid-a'), device(2, 'rid-b')]);
    findConfigsMock.mockResolvedValue(new Map([[2, configRow(2)]]));
    expect(await pushAdapter.resolveAddress({ type: 'user', id: 1 }, null)).toBe('2:rid-a,2:rid-b');
  });
});

describe('send', () => {
  it('按应用分组投递,各组使用所属应用凭证', async () => {
    findConfigsMock.mockResolvedValue(new Map([[2, configRow(2)], [3, configRow(3)]]));
    sendPushMock.mockResolvedValue({ success: true, msgId: 'm1' });

    const result = await pushAdapter.send(ctx('2:rid-a,3:rid-c,2:rid-b'));
    expect(result.providerMsgId).toBe('m1');
    expect(sendPushMock).toHaveBeenCalledTimes(2);
    const calls = sendPushMock.mock.calls.map((c) => c[0] as { config: PushConfigRow; registrationIds: string[] });
    expect(calls[0].config.appId).toBe(2);
    expect(calls[0].registrationIds).toEqual(['rid-a', 'rid-b']);
    expect(calls[1].config.appId).toBe(3);
    expect(calls[1].registrationIds).toEqual(['rid-c']);
  });

  it('部分应用组失败不抛错,避免 outbox 重投轰炸已成功组', async () => {
    findConfigsMock.mockResolvedValue(new Map([[2, configRow(2)], [3, configRow(3)]]));
    sendPushMock
      .mockResolvedValueOnce({ success: true, msgId: 'ok' })
      .mockResolvedValueOnce({ success: false, errorMsg: '极光推送失败: [1004] Authen failed' });

    const result = await pushAdapter.send(ctx('2:rid-a,3:rid-c'));
    expect(result.providerMsgId).toBe('ok');
  });

  it('全部应用组失败才按渠道失败上报', async () => {
    findConfigsMock.mockResolvedValue(new Map([[2, configRow(2)]]));
    sendPushMock.mockResolvedValue({ success: false, errorMsg: '极光推送失败: [1004] Authen failed' });

    await expect(pushAdapter.send(ctx('2:rid-a'))).rejects.toThrow('1004');
  });

  it('供应商点名的无效 RID 触发绑定清理', async () => {
    findConfigsMock.mockResolvedValue(new Map([[2, configRow(2)]]));
    sendPushMock.mockResolvedValue({
      success: false,
      errorMsg: '极光推送失败: [1003] The registration_id rid-a is invalid!',
      invalidRegistrationIds: ['rid-a'],
    });

    await expect(pushAdapter.send(ctx('2:rid-a'))).rejects.toThrow();
    expect(clearInvalidMock).toHaveBeenCalledWith('jpush', ['rid-a']);
  });
});
