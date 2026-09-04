import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as z from 'zod';
import { defineContract, idParam, op, paginated, paginationQuery, batchIdsBody } from '@zenith/shared/core';
import {
  ApiRecorder,
  type RecordedCall,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
  getCacheEntry,
  isFresh,
} from '@/test-utils/query-harness';

const recorder = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => recorder) }));

import { api, apiQueryOptions, contractKey, createResourceQueries, urlOf, useApiMutation } from './contract-query';

const itemSchema = z.object({ id: z.int(), name: z.string() });
const itemContract = defineContract('/api/items', {
  list: op.get('/', { query: paginationQuery.extend({ keyword: z.string().optional() }), response: paginated(itemSchema), summary: '列表' }),
  all: op.get('/all', { response: z.array(itemSchema.pick({ id: true, name: true })), summary: '全部' }),
  detail: op.get('/{id}', { params: idParam, response: itemSchema, summary: '详情' }),
  create: op.post('/', { body: z.object({ name: z.string() }), response: itemSchema, summary: '创建' }),
  update: op.put('/{id}', { params: idParam, body: z.object({ name: z.string().optional() }), response: itemSchema, summary: '更新' }),
  remove: op.delete('/{id}', { params: idParam, summary: '删除' }),
  removeBatch: op.delete('/batch', { body: batchIdsBody, summary: '批量删除' }),
  archive: op.post('/{id}/archive', { params: idParam, body: z.object({ reason: z.string() }), summary: '归档' }),
  exportFile: op.get('/export', { kind: 'excel', summary: '导出' }),
});

beforeEach(() => {
  recorder.reset();
  recorder
    .on('GET', '/api/items', (call: RecordedCall) => ({ list: [{ id: 1, name: call.url }], total: 1, page: 1, pageSize: 10 }))
    .on('GET', '/api/items/all', [{ id: 1, name: 'one' }])
    .on('GET', /\/api\/items\/\d+$/, (call: RecordedCall) => ({ id: Number(call.url.split('/').pop()), name: 'one' }))
    .on('POST', '/api/items', (call: RecordedCall) => ({ id: 9, ...(call.body as object) }))
    .on('PUT', /\/api\/items\/\d+$/, (call: RecordedCall) => ({ id: Number(call.url.split('/').pop()), ...(call.body as object) }))
    .on('DELETE', /\/api\/items\/\d+$/, null)
    .on('DELETE', '/api/items/batch', null)
    .on('POST', /\/api\/items\/\d+\/archive$/, null);
});

describe('urlOf / contractKey', () => {
  it('fills path params and appends the query string', () => {
    expect(urlOf(itemContract.detail, { params: { id: 7 } })).toBe('/api/items/7');
    expect(urlOf(itemContract.list, { query: { page: 2, pageSize: 20, keyword: '' } })).toBe('/api/items?page=2&pageSize=20');
    expect(urlOf(itemContract.all)).toBe('/api/items/all');
    expect(contractKey(itemContract.detail, { params: { id: 7 } })).toEqual(['items', 'detail', { params: { id: 7 } }]);
    expect(contractKey(itemContract.all)).toEqual(['items', 'all']);
  });
});

describe('api', () => {
  it('sends the method, url and body derived from the contract and unwraps data', async () => {
    const created = await api(itemContract.create, { body: { name: 'new' } });
    expect(created).toEqual({ id: 9, name: 'new' });
    expect(recorder.calls).toEqual([{ method: 'POST', url: '/api/items', body: { name: 'new' } }]);

    recorder.resetCalls();
    await api(itemContract.archive, { params: { id: 3 }, body: { reason: 'x' } });
    expect(recorder.calls).toEqual([{ method: 'POST', url: '/api/items/3/archive', body: { reason: 'x' } }]);

    recorder.resetCalls();
    await api(itemContract.removeBatch, { body: { ids: [1, 2] } });
    expect(recorder.calls).toEqual([{ method: 'DELETE', url: '/api/items/batch', body: { ids: [1, 2] } }]);
  });

  it('accepts request options as the trailing argument', async () => {
    const all = await api(itemContract.all, { silent: true });
    expect(all).toEqual([{ id: 1, name: 'one' }]);
    expect(recorder.calls).toEqual([{ method: 'GET', url: '/api/items/all' }]);
  });

  it('refuses binary operations', async () => {
    await expect(api(itemContract.exportFile)).rejects.toThrow(/excel/);
  });
});

describe('apiQueryOptions', () => {
  it('produces stable keys and a fetching queryFn', async () => {
    const opts = apiQueryOptions(itemContract.detail, { params: { id: 5 } });
    expect(opts.queryKey).toEqual(['items', 'detail', { params: { id: 5 } }]);
    const qc = createTestQueryClient();
    await expect(qc.fetchQuery(opts)).resolves.toEqual({ id: 5, name: 'one' });
  });
});

describe('createResourceQueries', () => {
  const items = createResourceQueries(itemContract);

  it('derives keys from the base path', () => {
    expect(items.keys.all).toEqual(['items']);
    expect(items.keys.lists).toEqual(['items', 'list']);
    expect(items.keys.detail(3)).toEqual(['items', 'detail', 3]);
    expect(items.keys.lookup).toEqual(['items', 'all']);
  });

  it('lists with the query string and fetches details by id', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ list: items.useList({ page: 1, pageSize: 10, keyword: 'k' }), detail: items.useDetail(4), lookup: items.useLookup() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.detail.isSuccess).toBe(true);
      expect(result.current.lookup.isSuccess).toBe(true);
    });
    expect(recorder.urls('GET')).toEqual(['/api/items?page=1&pageSize=10&keyword=k', '/api/items/4', '/api/items/all']);
    expect(result.current.detail.data).toEqual({ id: 4, name: 'one' });
  });

  it('saves via POST without id and PUT with id, then invalidates list, detail and lookup', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ list: items.useList({ page: 1, pageSize: 10 }), detail: items.useDetail(9), lookup: items.useLookup(), save: items.useSave() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => expect(result.current.lookup.isSuccess && result.current.detail.isSuccess && result.current.list.isSuccess).toBe(true));
    recorder.resetCalls();

    const created = await result.current.save.mutateAsync({ values: { name: 'a' } });
    expect(created).toEqual({ id: 9, name: 'a' });
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));
    expect(recorder.calls[0]).toEqual({ method: 'POST', url: '/api/items', body: { name: 'a' } });
    expect(recorder.countOf('GET', '/api/items')).toBe(1);
    expect(recorder.countOf('GET', '/api/items/9')).toBe(1);
    expect(recorder.countOf('GET', '/api/items/all')).toBe(1);

    recorder.resetCalls();
    await result.current.save.mutateAsync({ id: 9, values: { name: 'b' } });
    expect(recorder.calls[0]).toEqual({ method: 'PUT', url: '/api/items/9', body: { name: 'b' } });
  });

  it('deletes one by id, many via batch, and drops detail cache entries', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({ detail: items.useDetail(2), remove: items.useDelete() }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    expect(getCacheEntry(qc, items.keys.detail(2))).toBeDefined();
    recorder.resetCalls();

    await result.current.remove.mutateAsync([2]);
    expect(recorder.calls[0]).toEqual({ method: 'DELETE', url: '/api/items/2' });

    recorder.resetCalls();
    await result.current.remove.mutateAsync([3, 4]);
    expect(recorder.calls[0]).toEqual({ method: 'DELETE', url: '/api/items/batch', body: { ids: [3, 4] } });
    expect(isFresh(qc, items.keys.detail(3))).toBe(false);
  });
});

describe('useApiMutation', () => {
  it('uses the contract input as mutation variables and runs invalidate on success', async () => {
    const qc = createTestQueryClient();
    const invalidate = vi.fn();
    const { result } = renderHook(() => useApiMutation(itemContract.archive, { invalidate }), { wrapper: createWrapper(qc) });
    await result.current.mutateAsync({ params: { id: 8 }, body: { reason: 'done' } });
    expect(recorder.calls).toEqual([{ method: 'POST', url: '/api/items/8/archive', body: { reason: 'done' } }]);
    expect(invalidate).toHaveBeenCalledWith(qc, null, { params: { id: 8 }, body: { reason: 'done' } });
  });
});
