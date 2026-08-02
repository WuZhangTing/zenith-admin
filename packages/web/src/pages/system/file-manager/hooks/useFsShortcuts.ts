/**
 * 全局键盘快捷键：Ctrl+A 全选 / Ctrl+C 复制 / Ctrl+X 剪切 / Ctrl+V 粘贴 /
 * Delete 删除 / F2 重命名 / Enter 打开 / Backspace 上级目录 / Ctrl+L 路径直达 /
 * Esc 清除选择。
 *
 * keydown 监听只绑定一次；上下文与处理函数经 ref 转发（每次渲染刷新），
 * 避免因依赖变化反复解绑/重绑。
 */
import { useEffect, useRef } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { confirmDelete } from '@/utils/confirm';
import type { ClipOp, FmDialogState, FsEntry } from '../types';

interface ShortcutContext {
  selectedPaths: Set<string>;
  filteredEntries: FsEntry[];
  clipboard: { paths: string[]; op: ClipOp } | null;
  anyOverlayOpen: boolean;
  currentPath: string;
}

interface ShortcutHandlers {
  setSelectedPaths: (paths: Set<string>) => void;
  setClipboard: (clip: { paths: string[]; op: ClipOp } | null) => void;
  setDialog: (dialog: FmDialogState) => void;
  handlePaste: () => Promise<void>;
  handleDelete: (paths: string[]) => Promise<void>;
  handlePreview: (entry: FsEntry) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  goUp: () => void;
  startPathEdit: () => void;
}

export function useFsShortcuts(ctx: ShortcutContext, handlers: ShortcutHandlers) {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const c = ctxRef.current;
      const fns = handlersRef.current;
      if (c.anyOverlayOpen) return;
      // 焦点在输入框 / 富文本时不拦截
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      const selEntries = c.filteredEntries.filter((en) => c.selectedPaths.has(en.path));
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        fns.setSelectedPaths(new Set(c.filteredEntries.map((en) => en.path)));
      } else if (mod && e.key.toLowerCase() === 'c' && selEntries.length > 0) {
        e.preventDefault();
        fns.setClipboard({ paths: selEntries.map((en) => en.path), op: 'copy' });
        Toast.info({ content: `已复制 ${selEntries.length} 项`, duration: 1 });
      } else if (mod && e.key.toLowerCase() === 'x' && selEntries.length > 0) {
        e.preventDefault();
        fns.setClipboard({ paths: selEntries.map((en) => en.path), op: 'cut' });
        Toast.info({ content: `已剪切 ${selEntries.length} 项`, duration: 1 });
      } else if (mod && e.key.toLowerCase() === 'v' && c.clipboard) {
        e.preventDefault();
        void fns.handlePaste();
      } else if (e.key === 'Delete' && selEntries.length > 0) {
        e.preventDefault();
        confirmDelete({
          title: `确定删除选中的 ${selEntries.length} 项吗？`,
          content: selEntries.slice(0, 5).map((en) => en.name).join('、') + (selEntries.length > 5 ? ` 等 ${selEntries.length} 项` : ''),
          onOk: () => fns.handleDelete(selEntries.map((en) => en.path)),
        });
      } else if (e.key === 'F2' && selEntries.length === 1) {
        e.preventDefault();
        fns.setDialog({ mode: 'rename', entry: selEntries[0], value: selEntries[0].name });
      } else if (e.key === 'Enter' && selEntries.length === 1) {
        e.preventDefault();
        const en = selEntries[0];
        if (en.type === 'dir') void fns.navigateTo(en.path);
        else void fns.handlePreview(en);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        fns.goUp();
      } else if (mod && e.key.toLowerCase() === 'l') {
        // Ctrl+L：路径直达输入（拦截浏览器地址栏聚焦）
        e.preventDefault();
        fns.startPathEdit();
      } else if (e.key === 'Escape') {
        fns.setSelectedPaths(new Set());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
