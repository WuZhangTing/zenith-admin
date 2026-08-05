/**
 * useEditModal 契约测试。
 *
 * 这里锁的是四条**可以被静默漏掉**的编排契约。它们的共同点是：漏写不会报错、
 * 不会让任何现有测试变红，只能靠人工逐页 review 发现——而全站有 169 个手抄点。
 *
 * 其中「详情到达必须重挂载表单」一条在迁移前的 `TenantsPage` /
 * `TenantPackagesPage` 上是实际失效的：`initValues` 只在挂载时读取一次，
 * 弹窗打开后才返回的详情永远进不了表单。当时未暴露，仅因为这两个资源的
 * 列表与详情恰好经同一个 `mapTenant` 返回了相同字段集。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const toastSuccess = vi.fn();
vi.mock('@douyinfe/semi-ui', () => ({
  Toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import { useEditModal, type DetailHook } from './useEditModal';

interface Row {
  id: number;
  name: string;
  remark?: string;
}

/** 可控的表单替身：validate 要么返回值，要么按 Semi 的行为 reject */
function makeFormApi(values: Record<string, unknown>, shouldFail = false) {
  return {
    validate: vi.fn(() => (shouldFail ? Promise.reject(new Error('field required')) : Promise.resolve(values))),
  };
}

function makeSave(impl?: (v: { id?: number; values: unknown }) => Promise<Row>) {
  const mutateAsync = vi.fn(impl ?? (async ({ id }) => ({ id: id ?? 99, name: 'saved' })));
  return { mutateAsync, isPending: false };
}

beforeEach(() => {
  toastSuccess.mockClear();
});

describe('打开与初始值', () => {
  it('新增时使用 defaults，且表单 key 标记为 new', () => {
    const save = makeSave();
    const { result } = renderHook(() => useEditModal<Row>({ entityName: '角色', save, defaults: { name: '' } }));

    act(() => result.current.openCreate());

    expect(result.current.visible).toBe(true);
    expect(result.current.isEdit).toBe(false);
    expect(result.current.modalProps.title).toBe('新增角色');
    expect(result.current.formProps.initValues).toEqual({ name: '' });
    expect(result.current.formProps.key).toBe('new:row');
  });

  it('defaults 为函数时每次打开重新求值', () => {
    const save = makeSave();
    let seq = 0;
    const { result } = renderHook(() =>
      useEditModal<Row>({ entityName: '角色', save, defaults: () => ({ name: `n${++seq}` }) }),
    );

    act(() => result.current.openCreate());
    expect(result.current.formProps.initValues).toEqual({ name: 'n1' });

    act(() => result.current.close());
    act(() => result.current.openCreate());
    expect(result.current.formProps.initValues).toEqual({ name: 'n2' });
  });

  it('编辑时以记录为初始值，并可用 toValues 裁剪字段', () => {
    const save = makeSave();
    const { result } = renderHook(() =>
      useEditModal<Row>({
        entityName: '角色',
        save,
        toValues: (r) => ({ name: r.name }),
      }),
    );

    act(() => result.current.openEdit({ id: 7, name: 'admin', remark: 'x' }));

    expect(result.current.isEdit).toBe(true);
    expect(result.current.modalProps.title).toBe('编辑角色');
    expect(result.current.formProps.initValues).toEqual({ name: 'admin' });
    expect(result.current.formProps.key).toBe('7:row');
  });
});

describe('异步详情：到达后必须重挂载表单', () => {
  it('详情返回后 key 变化，initValues 切换为详情数据', () => {
    const save = makeSave();
    // 先返回 undefined（加载中），再返回详情——模拟弹窗打开后详情才到达
    let detailData: Row | undefined = undefined;
    const useDetail: DetailHook<Row> = () => ({ data: detailData, isFetching: detailData === undefined });

    const { result, rerender } = renderHook(() => useEditModal<Row>({ entityName: '租户', save, useDetail }));

    act(() => result.current.openEdit({ id: 12, name: '列表行' }));
    // 详情未到达：用列表行占位
    expect(result.current.formProps.initValues).toMatchObject({ name: '列表行' });
    expect(result.current.formProps.key).toBe('12:row');
    expect(result.current.detailLoading).toBe(true);
    // 详情加载期间禁止提交，避免把占位数据当成完整记录保存
    expect(result.current.modalProps.okButtonProps.disabled).toBe(true);

    detailData = { id: 12, name: '详情名', remark: '仅详情返回的字段' };
    rerender();

    // key 必须变化，否则 Semi 不会重新读取 initValues
    expect(result.current.formProps.key).toBe('12:detail');
    expect(result.current.formProps.initValues).toMatchObject({ name: '详情名', remark: '仅详情返回的字段' });
    expect(result.current.detailLoading).toBe(false);
    expect(result.current.modalProps.okButtonProps.disabled).toBe(false);
  });

  it('未配置 useDetail 时不产生详情态', () => {
    const save = makeSave();
    const { result } = renderHook(() => useEditModal<Row>({ entityName: '角色', save }));
    act(() => result.current.openEdit({ id: 3, name: 'a' }));
    expect(result.current.detailLoading).toBe(false);
    expect(result.current.formProps.key).toBe('3:row');
  });
});

describe('提交编排', () => {
  it('校验失败时抛出以中断，且不调用保存、不关闭弹窗', async () => {
    const save = makeSave();
    const { result } = renderHook(() => useEditModal<Row>({ entityName: '角色', save }));

    act(() => result.current.openCreate());
    act(() => result.current.formProps.getFormApi(makeFormApi({}, true) as never));

    await expect(result.current.modalProps.onOk()).rejects.toThrow('validation');

    expect(save.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(true);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('新增成功：以无 id 保存、提示创建成功、关闭并清空 editing', async () => {
    const save = makeSave();
    const { result } = renderHook(() => useEditModal<Row>({ entityName: '角色', save }));

    act(() => result.current.openCreate());
    act(() => result.current.formProps.getFormApi(makeFormApi({ name: 'new' }) as never));
    await act(async () => {
      await result.current.modalProps.onOk();
    });

    expect(save.mutateAsync).toHaveBeenCalledWith({ id: undefined, values: { name: 'new' } });
    expect(toastSuccess).toHaveBeenCalledWith('创建成功');
    expect(result.current.visible).toBe(false);
    expect(result.current.editing).toBeNull();
  });

  it('编辑成功：带 id 保存并提示更新成功', async () => {
    const save = makeSave();
    const { result } = renderHook(() => useEditModal<Row>({ entityName: '角色', save }));

    act(() => result.current.openEdit({ id: 5, name: 'old' }));
    act(() => result.current.formProps.getFormApi(makeFormApi({ name: 'new' }) as never));
    await act(async () => {
      await result.current.modalProps.onOk();
    });

    expect(save.mutateAsync).toHaveBeenCalledWith({ id: 5, values: { name: 'new' } });
    expect(toastSuccess).toHaveBeenCalledWith('更新成功');
  });

  it('beforeSave 可注入页面级上下文', async () => {
    const save = makeSave();
    const { result } = renderHook(() =>
      useEditModal<Row, Record<string, unknown>>({
        entityName: '友链',
        save,
        beforeSave: (values, ctx) => (ctx.isEdit ? values : { ...values, siteId: 42 }),
      }),
    );

    act(() => result.current.openCreate());
    act(() => result.current.formProps.getFormApi(makeFormApi({ name: 'a' }) as never));
    await act(async () => {
      await result.current.modalProps.onOk();
    });

    expect(save.mutateAsync).toHaveBeenCalledWith({ id: undefined, values: { name: 'a', siteId: 42 } });
  });

  it('保存后再点新增，不会带出上一次编辑的记录', async () => {
    const save = makeSave();
    const { result } = renderHook(() => useEditModal<Row>({ entityName: '角色', save, defaults: { name: '' } }));

    act(() => result.current.openEdit({ id: 8, name: 'old' }));
    act(() => result.current.formProps.getFormApi(makeFormApi({ name: 'x' }) as never));
    await act(async () => {
      await result.current.modalProps.onOk();
    });

    act(() => result.current.openCreate());
    expect(result.current.isEdit).toBe(false);
    expect(result.current.formProps.initValues).toEqual({ name: '' });
    expect(result.current.formProps.key).toBe('new:row');
  });

  it('successMessage 可覆盖默认提示，onSaved 拿到保存结果', async () => {
    const save = makeSave(async () => ({ id: 100, name: 'saved' }));
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useEditModal<Row>({ save, successMessage: () => '已提交审核', onSaved }),
    );

    act(() => result.current.openCreate());
    act(() => result.current.formProps.getFormApi(makeFormApi({ name: 'a' }) as never));
    await act(async () => {
      await result.current.modalProps.onOk();
    });

    expect(toastSuccess).toHaveBeenCalledWith('已提交审核');
    expect(onSaved).toHaveBeenCalledWith({ id: 100, name: 'saved' }, { editing: null, isEdit: false });
  });
  it('successMessage 返回 null 时不弹提示，但仍关闭并回调 onSaved', async () => {
    const save = makeSave();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useEditModal<Row>({ save, successMessage: () => null, onSaved }),
    );

    act(() => result.current.openCreate());
    act(() => result.current.formProps.getFormApi(makeFormApi({ name: 'a' }) as never));
    await act(async () => {
      await result.current.modalProps.onOk();
    });

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
    expect(onSaved).toHaveBeenCalled();
  });
});

describe('多编辑单元共存', () => {
  it('同一组件内两次调用互不干扰', () => {
    const saveA = makeSave();
    const saveB = makeSave();
    const { result } = renderHook(() => ({
      a: useEditModal<Row>({ entityName: '友链', save: saveA }),
      b: useEditModal<Row>({ entityName: '分组', save: saveB }),
    }));

    act(() => result.current.a.openEdit({ id: 1, name: 'link' }));

    expect(result.current.a.visible).toBe(true);
    expect(result.current.b.visible).toBe(false);
    expect(result.current.a.modalProps.title).toBe('编辑友链');
    expect(result.current.b.modalProps.title).toBe('新增分组');
  });
});
