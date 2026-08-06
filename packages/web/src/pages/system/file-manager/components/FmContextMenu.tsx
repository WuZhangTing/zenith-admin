/** 右键菜单：由 Dropdown 负责视口边界碰撞与自动翻转 */
import { Dropdown } from '@douyinfe/semi-ui';
import { CursorContextDropdown } from '@/components/CursorContextDropdown';
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

  const menuContent = (
    <Dropdown.Menu>
      {items.map((item) => (
        <Dropdown.Item
          key={item.label}
          type={item.danger ? 'danger' : undefined}
          onClick={item.fn}
        >
          {item.label}
        </Dropdown.Item>
      ))}
    </Dropdown.Menu>
  );

  return (
    <CursorContextDropdown
      point={ctx}
      contextKey={entry.path}
      render={menuContent}
      onClose={onClose}
    />
  );
}
