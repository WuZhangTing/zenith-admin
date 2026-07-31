/**
 * announcements 域缓存一致性契约（S4 跨域试点）
 *
 * 这个域的特殊性在于同一个根键下挂着**三棵互不相干的子树**：
 * 管理端列表/详情、收件箱（`my`）、已读统计，外加两份并不属于本域的下拉源。
 * 收敛前一次保存会把它们全部打掉。
 *
 * 两个与前两个试点不同的结论：
 *  1. **不能回填**：写接口返回公告主体，详情接口额外带 recipients / attachments，
 *     形状不一致，`setQueryData` 会丢字段。
 *  2. **跨域 lookup 归还所有者域**：收件人选项拉的是 /api/roles/all 与
 *     /api/departments/flat，原先却以 announcementKeys 为键，导致角色或部门被
 *     增删改后没有任何来源会失效它。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  ApiRecorder,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
  hasCacheEntry,
  isFresh,
  isInvalidated,
  observeFetches,
} from '@/test-utils/query-harness';

const api = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => api) }));

import {
  announcementKeys,
  useAnnouncementList,
  useAnnouncementRecipientOptions,
  useAnnouncementUserSearch,
  useDeleteAnnouncement,
  useMarkMyAnnouncementRead,
  useMyAnnouncementList,
  useSaveAnnouncement,
} from './announcements';
import { roleKeys, useSaveRole } from './roles';
import { departmentKeys } from './departments';

const LIST_PARAMS = { page: 1, pageSize: 10 };
const MY_LIST_PARAMS = { page: 1, pageSize: 10 };

const NOTICE = { id: 1, title: '系统维护', content: '正文', publishStatus: 'published' };

beforeEach(() => {
  api.reset();
  api
    .on('GET', '/api/announcements', { list: [NOTICE], total: 1, page: 1, pageSize: 10 })
    .on('GET', '/api/announcements/inbox', { list: [NOTICE], total: 1, page: 1, pageSize: 10 })
    .on('GET', '/api/roles/all', [{ id: 1, name: '管理员' }])
    .on('GET', '/api/departments/flat', [{ id: 1, name: '研发部' }])
    .on('GET', '/api/users', { list: [{ id: 1, nickname: '张三', username: 'zhangsan' }], total: 1, page: 1, pageSize: 20 })
    .on('POST', '/api/announcements', NOTICE)
    .on('PUT', '/api/announcements/1', NOTICE)
    .on('POST', '/api/announcements/1/read', null)
    .on('POST', '/api/roles', { id: 2, name: '审核员' })
    .on('DELETE', '/api/announcements/1', null);
});

describe('useSaveAnnouncement —— 保存时弹窗仍开着，下拉源不应被牵连', () => {
  it('leaves the modal-scoped recipient and user-search lookups untouched', async () => {
    const qc = createTestQueryClient();
    // 还原保存瞬间的真实挂载：弹窗未关闭，故收件人选项与用户搜索都是活跃查询
    const { result } = renderHook(
      () => ({
        list: useAnnouncementList(LIST_PARAMS),
        recipients: useAnnouncementRecipientOptions(true),
        userSearch: useAnnouncementUserSearch('张', true),
        save: useSaveAnnouncement(),
      }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.recipients.isSuccess).toBe(true);
      expect(result.current.userSearch.isSuccess).toBe(true);
    });

    const fetches = observeFetches(qc);
    api.resetCalls();

    await result.current.save.mutateAsync({ id: 1, values: { title: '系统维护' } });
    await waitFor(() => expect(fetches.countOf(announcementKeys.lists)).toBe(1));
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));

    // 收敛前这三个请求都会被 `.all` 触发
    expect(api.countOf('GET', '/api/roles/all')).toBe(0);
    expect(api.countOf('GET', '/api/departments/flat')).toBe(0);
    expect(api.countOf('GET', '/api/users')).toBe(0);
    expect(isFresh(qc, roleKeys.allRoles)).toBe(true);
    expect(isFresh(qc, departmentKeys.flat)).toBe(true);

    fetches.stop();
  });

  it('still marks the inbox subtree stale so the reader side cannot show removed or renamed notices', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ list: useAnnouncementList(LIST_PARAMS), save: useSaveAnnouncement() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    // 收件箱在另一路由：此刻未挂载，失效它只标脏、不发请求，代价接近零
    qc.setQueryData(announcementKeys.myList(MY_LIST_PARAMS), { list: [], total: 0 });
    api.resetCalls();

    await result.current.save.mutateAsync({ id: 1, values: { title: '系统维护' } });

    expect(isInvalidated(qc, announcementKeys.myList(MY_LIST_PARAMS))).toBe(true);
    expect(api.countOf('GET', '/api/announcements/inbox')).toBe(0);
  });
});

describe('useMarkMyAnnouncementRead —— 只动收件箱与已读统计', () => {
  it('refreshes the inbox without touching the admin list', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ inbox: useMyAnnouncementList(MY_LIST_PARAMS), markRead: useMarkMyAnnouncementRead() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => expect(result.current.inbox.isSuccess).toBe(true));

    // 管理端列表此刻未挂载但有缓存，标记已读不应影响它
    qc.setQueryData(announcementKeys.list(LIST_PARAMS), { list: [NOTICE], total: 1 });

    const fetches = observeFetches(qc);
    api.resetCalls();

    await result.current.markRead.mutateAsync(1);
    await waitFor(() => expect(fetches.countOf(announcementKeys.myLists)).toBe(1));

    expect(isInvalidated(qc, announcementKeys.list(LIST_PARAMS))).toBe(false);
    expect(api.countOf('GET', '/api/announcements')).toBe(0);

    fetches.stop();
  });
});

describe('收件人选项归还所有者域', () => {
  it('refreshes when a role changes, which the old announcement-scoped cache never did', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ recipients: useAnnouncementRecipientOptions(true), saveRole: useSaveRole() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => expect(result.current.recipients.isSuccess).toBe(true));

    api.resetCalls();
    await result.current.saveRole.mutateAsync({ values: { name: '审核员' } });

    // 角色域的 mutation 现在能正确波及公告页的收件人下拉
    await waitFor(() => expect(api.countOf('GET', '/api/roles/all')).toBe(1));
  });
});

describe('useDeleteAnnouncement', () => {
  it('drops both the admin and inbox detail caches for the deleted notice', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ list: useAnnouncementList(LIST_PARAMS), remove: useDeleteAnnouncement() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    qc.setQueryData(announcementKeys.detail(1), NOTICE);
    qc.setQueryData(announcementKeys.myDetail(1), NOTICE);

    await result.current.remove.mutateAsync(1);
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));

    expect(hasCacheEntry(qc, announcementKeys.detail(1))).toBe(false);
    expect(hasCacheEntry(qc, announcementKeys.myDetail(1))).toBe(false);
  });
});
