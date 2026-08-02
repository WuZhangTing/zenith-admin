/** 右键菜单：固定定位浮层 + 全屏透明遮罩关闭 */
import React from 'react';
import { isArchive, isEditableFile } from '../fs-utils';
import type { EntryActions } from '../entry-actions';
import type { FsEntry } from '../types';

interface FmContextMenuProps {
  readonly ctx: { entry: FsEntry; x: number; y: number } | null;
  readonly isWindows: boolean;
  readonly actions: EntryActions;
  readonly onClose: () => void;
}

export default function FmContextMenu({ ctx, isWindows, actions, onClose }: Readonly<FmContextMenuProps>) {
  if (!ctx) return null;
  const { entry } = ctx;
  const isDir = entry.type === 'dir';
  const isFile = !isDir;
  const run = (fn: () => void) => () => { fn(); onClose(); };
  const items: { label: string; fn: () => void; danger?: boolean }[] = [
    {
      label: isDir ? '打开' : '下载',
      fn: run(() => { if (isDir) void actions.navigateTo(entry.path); else actions.onDownload(entry); }),
    },
    ...(isFile ? [{ label: '预览', fn: run(() => actions.onPreview(entry)) }] : []),
    ...(isFile && isEditableFile(entry.name) ? [{ label: '编辑', fn: run(() => actions.onEdit(entry)) }] : []),
    { label: '重命名', fn: run(() => actions.onRename(entry)) },
    { label: '复制到…', fn: run(() => actions.onCopyTo([entry])) },
    { label: '移动到…', fn: run(() => actions.onMoveTo([entry])) },
    { label: '压缩为 ZIP', fn: run(() => actions.onCompress([entry], `${entry.name}.zip`)) },
    ...(isFile && isArchive(entry.name) ? [{ label: '解压到此处', fn: run(() => actions.onExtract(entry)) }] : []),
    ...(isFile ? [{ label: '校验和', fn: run(() => actions.onChecksum(entry)) }] : []),
    ...(isWindows ? [] : [{ label: '修改权限', fn: run(() => actions.onChmod(entry)) }]),
    ...(isDir ? [{ label: '上传到此目录', fn: run(() => actions.onUploadTo(entry.path)) }] : []),
    { label: '属性', fn: run(() => actions.onProps(entry)) },
    { label: '删除', fn: run(() => actions.onDelete([entry.path])), danger: true },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="关闭菜单"
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'transparent', border: 'none', padding: 0, cursor: 'default' }}
        onClick={onClose}
        onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); onClose(); }}
      />
      <div style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 1001, minWidth: 150, background: 'var(--semi-color-bg-3)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--semi-border-radius-medium)', boxShadow: 'var(--semi-shadow-elevated)', padding: '4px 0' }}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.fn}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', color: item.danger ? 'var(--semi-color-danger)' : 'var(--semi-color-text-0)', font: 'inherit', fontSize: 13 }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
