/**
 * confirmDanger / confirmDelete 契约测试。
 *
 * 核心是锁住「破坏性操作的确认按钮必须是红色实心」——此前这条样式由每个调用点
 * 手写 okButtonProps，全仓 223 个破坏性确认里有 64 个漏写，渲染成与普通确认
 * 无异的蓝色主按钮。契约收进 helper 后调用方漏不掉。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const confirmMock = vi.fn();
vi.mock('@douyinfe/semi-ui', () => ({ Modal: { confirm: (...args: unknown[]) => confirmMock(...args) } }));

import { confirmDanger, confirmDelete } from './confirm';

const lastCall = () => confirmMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => confirmMock.mockClear());

describe('confirmDanger', () => {
  it('注入红色实心确认按钮', () => {
    confirmDanger({ title: '清空浏览历史', onOk: vi.fn() });
    expect(lastCall().okButtonProps).toEqual({ type: 'danger', theme: 'solid' });
  });

  it('其余选项原样透传，不改写文案', () => {
    const onOk = vi.fn();
    const onCancel = vi.fn();
    confirmDanger({ title: '彻底删除 3 条内容？', content: '删除后不可恢复', okText: '彻底删除', cancelText: '再想想', onOk, onCancel });
    expect(lastCall()).toMatchObject({
      title: '彻底删除 3 条内容？',
      content: '删除后不可恢复',
      okText: '彻底删除',
      cancelText: '再想想',
      onOk,
      onCancel,
    });
  });

  it('调用点可覆盖按钮样式（如弱化为 borderless）', () => {
    confirmDanger({ title: 'x', okButtonProps: { theme: 'borderless' } });
    expect(lastCall().okButtonProps).toEqual({ type: 'danger', theme: 'borderless' });
  });

  it('不擅自设置 title —— 调用方未传时保持未定义', () => {
    confirmDanger({ content: '仅内容' });
    expect(lastCall().title).toBeUndefined();
  });
});

describe('confirmDelete', () => {
  it('无参数时使用默认标题', () => {
    confirmDelete();
    expect(lastCall().title).toBe('确定要删除吗？');
  });

  it('调用方标题优先，绝不被默认值覆盖', () => {
    // 具体文案（指明删除对象）比通用文案更能防误操作，helper 不得统一
    confirmDelete({ title: '确定要删除该评测集吗？' });
    expect(lastCall().title).toBe('确定要删除该评测集吗？');
  });

  it('同样注入红色实心按钮', () => {
    confirmDelete({ onOk: vi.fn() });
    expect(lastCall().okButtonProps).toEqual({ type: 'danger', theme: 'solid' });
  });

  it('透传 content 与异步 onOk', async () => {
    const onOk = vi.fn().mockResolvedValue(undefined);
    confirmDelete({ content: '删除后不可恢复', onOk });
    expect(lastCall().content).toBe('删除后不可恢复');
    await (lastCall().onOk as () => Promise<void>)();
    expect(onOk).toHaveBeenCalledTimes(1);
  });
});
