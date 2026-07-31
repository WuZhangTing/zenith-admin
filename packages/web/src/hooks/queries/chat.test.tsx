/**
 * chat 域群成员缓存归一（S7 首个切片）
 *
 * 背景：ChatPage 曾把群成员镜像成本地 useState，只在切换会话时手工拉一次；
 * 而 GroupMembersPanel 用的是 `useChatGroupMembers`（Query 缓存）。同一份服务端
 * 状态存在两份副本，成员相关 mutation 只会刷新面板那份，页面那份保持陈旧。
 *
 * 后果不止于列表显示：ChatPage 用它算 @提及候选、**群主判定（决定操作权限）**
 * 与在线状态拉取名单，转让群主后页面仍按旧数据判断。
 *
 * 这些用例锁定「单一数据源」这一修复：成员类 mutation 之后，任何读取
 * `chatKeys.groupMembers(convId)` 的消费方都必须拿到同一份最新数据。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ChatGroupMember } from '@zenith/shared/chat';
import {
  ApiRecorder,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
  getCacheEntry,
  observeFetches,
} from '@/test-utils/query-harness';

const api = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => api) }));

import {
  chatKeys,
  useAddChatGroupMember,
  useChatGroupMembers,
  useTransferChatGroupOwner,
} from './chat';

const OWNER_ALICE: ChatGroupMember[] = [
  { id: 1, nickname: '爱丽丝', role: 'owner' } as ChatGroupMember,
  { id: 2, nickname: '鲍勃', role: 'member' } as ChatGroupMember,
];

const OWNER_BOB: ChatGroupMember[] = [
  { id: 1, nickname: '爱丽丝', role: 'member' } as ChatGroupMember,
  { id: 2, nickname: '鲍勃', role: 'owner' } as ChatGroupMember,
];

beforeEach(() => {
  api.reset();
  api
    .on('GET', '/api/chat/conversations/10/members', OWNER_ALICE)
    .on('POST', '/api/chat/conversations/10/members', null)
    .on('POST', '/api/chat/conversations/10/transfer', null);
});

describe('群成员单一数据源', () => {
  it('serves the page and the members panel from one cache entry, so both refresh together', async () => {
    const qc = createTestQueryClient();
    // 两个消费方模拟 ChatPage 与 GroupMembersPanel 同时读取
    const { result } = renderHook(
      () => ({
        page: useChatGroupMembers(10, true),
        panel: useChatGroupMembers(10, true),
        addMember: useAddChatGroupMember(),
      }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.page.isSuccess).toBe(true);
      expect(result.current.panel.isSuccess).toBe(true);
    });

    // 共用一个 key，因此只发一次请求
    expect(api.countOf('GET', '/api/chat/conversations/10/members')).toBe(1);

    const fetches = observeFetches(qc);
    api.on('GET', '/api/chat/conversations/10/members', [
      ...OWNER_ALICE,
      { id: 3, nickname: '查理', role: 'member' } as ChatGroupMember,
    ]);

    await result.current.addMember.mutateAsync({ conversationId: 10, userId: 3 });
    await waitFor(() => expect(fetches.countOf(chatKeys.groupMembers(10))).toBe(1));
    await waitFor(() => expect(result.current.page.data).toHaveLength(3));

    // 关键：两个消费方拿到的是同一份最新数据，不存在一方陈旧
    expect(result.current.page.data).toEqual(result.current.panel.data);

    fetches.stop();
  });

  it('propagates an ownership transfer to the page, which derives operator permissions from it', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ page: useChatGroupMembers(10, true), transfer: useTransferChatGroupOwner() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => expect(result.current.page.isSuccess).toBe(true));

    const isOwner = (members: ChatGroupMember[] | undefined, userId: number) =>
      (members ?? []).some((m) => m.id === userId && m.role === 'owner');
    expect(isOwner(result.current.page.data, 1)).toBe(true);

    api.on('GET', '/api/chat/conversations/10/members', OWNER_BOB);
    await result.current.transfer.mutateAsync({ conversationId: 10, newOwnerId: 2 });

    await waitFor(() => expect(isOwner(result.current.page.data, 2)).toBe(true));
    // 转让后原群主不应仍被判定为群主（此前页面副本不刷新，会继续放行群主操作）
    expect(isOwner(result.current.page.data, 1)).toBe(false);
    expect(getCacheEntry<ChatGroupMember[]>(qc, chatKeys.groupMembers(10))).toEqual(OWNER_BOB);
  });

  it('does not fetch members for a direct conversation', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => useChatGroupMembers(10, false), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(api.countOf('GET', '/api/chat/conversations/10/members')).toBe(0);
    expect(result.current.data).toBeUndefined();
  });
});
