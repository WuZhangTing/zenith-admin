/**
 * 剪贴板工具契约测试。
 *
 * 内网以 http://ip 访问时不是安全上下文，navigator.clipboard 为 undefined；
 * 锁住「写文本回退 execCommand、读文本返回 null、Toast 反馈跟随结果」三条行为。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@douyinfe/semi-ui', () => ({ Toast: toastMock }));

import { canWriteClipboardItems, copyText, copyTextWithToast, readClipboardText } from './clipboard';

const originalClipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')
  ?? Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function setClipboard(value: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  document.execCommand = vi.fn(() => true);
});

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('copyText', () => {
  it('安全上下文优先 Clipboard API，不触发 execCommand', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it('非安全上下文（navigator.clipboard 不存在）回退 execCommand 且不残留 textarea', async () => {
    setClipboard(undefined);
    await expect(copyText('内网复制')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('Clipboard API 被拒绝时回退 execCommand', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) });
    await expect(copyText('x')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('回退路径也失败时返回 false 而不抛错', async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn(() => false);
    await expect(copyText('x')).resolves.toBe(false);
  });

  it('回退路径复制后把焦点还给原活动元素', async () => {
    setClipboard(undefined);
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    await copyText('x');
    expect(document.activeElement).toBe(button);
    button.remove();
  });
});

describe('copyTextWithToast', () => {
  it('成功时提示默认文案，可覆盖', async () => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    await copyTextWithToast('a');
    expect(toastMock.success).toHaveBeenCalledWith('已复制');
    await copyTextWithToast('b', { success: '链接已复制' });
    expect(toastMock.success).toHaveBeenLastCalledWith('链接已复制');
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('失败时提示错误文案', async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn(() => false);
    await expect(copyTextWithToast('a', { error: '复制失败，请手动复制链接' })).resolves.toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith('复制失败，请手动复制链接');
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

describe('readClipboardText / canWriteClipboardItems', () => {
  it('非安全上下文读取返回 null、富内容写入不可用', async () => {
    setClipboard(undefined);
    await expect(readClipboardText()).resolves.toBeNull();
    expect(canWriteClipboardItems()).toBe(false);
  });

  it('读取被拒绝时返回 null，可用时返回文本', async () => {
    setClipboard({ readText: vi.fn().mockRejectedValue(new Error('denied')) });
    await expect(readClipboardText()).resolves.toBeNull();
    setClipboard({ readText: vi.fn().mockResolvedValue('pasted') });
    await expect(readClipboardText()).resolves.toBe('pasted');
  });
});
