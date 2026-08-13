import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('./email', () => ({
  sendMail: vi.fn(),
}));

vi.mock('./http-client', () => ({
  httpPost: vi.fn(),
}));

vi.mock('../services/messaging/in-app-messages.service', () => ({
  sendSystemInApp: vi.fn(),
}));

vi.mock('./logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '../db';
import { sendMail } from './email';
import { sendSystemInApp } from '../services/messaging/in-app-messages.service';
import { dispatchAlertChannels } from './alert-dispatch';

const dbMock = vi.mocked(db);
const sendMailMock = vi.mocked(sendMail);
const sendSystemInAppMock = vi.mocked(sendSystemInApp);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSelectChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'where']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('dispatchAlertChannels', () => {
  it('按用户 ID 投递站内信，并合并用户当前邮箱与额外邮箱', async () => {
    dbMock.select.mockReturnValueOnce(createSelectChain([
      { id: 1, email: 'Admin@Example.com' },
      { id: 2, email: null },
    ]));
    sendMailMock.mockResolvedValue(undefined);
    sendSystemInAppMock.mockResolvedValue(undefined);

    await dispatchAlertChannels(
      {
        channels: ['email', 'inapp'],
        webhookUrl: null,
        recipientUserIds: [1, 2],
        recipientEmails: ['team@example.com', 'ADMIN@example.com'],
        tenantId: null,
      },
      {
        subject: '测试告警',
        html: '<p>测试</p>',
        title: '测试告警',
        content: '测试',
        webhookBody: {},
        logTag: 'TestAlert',
      },
    );

    expect(sendSystemInAppMock).toHaveBeenCalledWith(expect.objectContaining({
      userIds: [1, 2],
    }));
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock.mock.calls.map(([email]) => email).sort()).toEqual([
      'admin@example.com',
      'team@example.com',
    ]);
  });

  it('仅配置额外邮箱时不查询用户', async () => {
    sendMailMock.mockResolvedValue(undefined);

    const result = await dispatchAlertChannels(
      {
        channels: ['email'],
        webhookUrl: null,
        recipientUserIds: [],
        recipientEmails: ['external@example.com'],
        tenantId: 1,
      },
      {
        subject: '测试告警',
        html: '<p>测试</p>',
        title: '测试告警',
        content: '测试',
        webhookBody: {},
        logTag: 'TestAlert',
      },
    );

    expect(dbMock.select).not.toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledWith('external@example.com', '测试告警', '<p>测试</p>');
    expect(result).toEqual({ status: 'success', channels: ['email'], error: null });
  });

  it('没有配置任何渠道时返回 skipped，而非当成一次成功派发', async () => {
    const result = await dispatchAlertChannels(
      { channels: [], webhookUrl: null, recipientUserIds: [], recipientEmails: [], tenantId: null },
      { subject: 's', html: 'h', title: 't', content: 'c', webhookBody: {}, logTag: 'TestAlert' },
    );

    expect(result).toEqual({ status: 'skipped', channels: [], error: null });
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(sendSystemInAppMock).not.toHaveBeenCalled();
  });

  it('接收人配置正确但无可用邮箱时计为失败，不再静默当成已送达', async () => {
    // 这是「配置看起来正确却没人收到」的典型成因，必须能从派发结果上被发现
    dbMock.select.mockReturnValueOnce(createSelectChain([{ id: 2, email: null }]));

    const result = await dispatchAlertChannels(
      { channels: ['email'], webhookUrl: null, recipientUserIds: [2], recipientEmails: [], tenantId: null },
      { subject: 's', html: 'h', title: 't', content: 'c', webhookBody: {}, logTag: 'TestAlert' },
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('email');
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('部分渠道失败时返回 partial 并保留失败原因', async () => {
    dbMock.select.mockReturnValueOnce(createSelectChain([{ id: 1, email: 'admin@example.com' }]));
    sendSystemInAppMock.mockResolvedValue(undefined);
    sendMailMock.mockRejectedValue(new Error('SMTP 连接超时'));

    const result = await dispatchAlertChannels(
      { channels: ['email', 'inapp'], webhookUrl: null, recipientUserIds: [1], recipientEmails: [], tenantId: null },
      { subject: 's', html: 'h', title: 't', content: 'c', webhookBody: {}, logTag: 'TestAlert' },
    );

    expect(result.status).toBe('partial');
    expect(result.channels).toEqual(['email', 'inapp']);
    expect(result.error).toContain('SMTP 连接超时');
  });
});
