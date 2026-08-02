/**
 * 条目操作的统一回调接口：表格操作列与右键菜单是同一动作集在两个 UI 上的投影，
 * 共享此接口避免双份定义漂移。
 */
import type { FsEntry } from './types';

export interface EntryActions {
  navigateTo: (path: string) => Promise<void>;
  onPreview: (entry: FsEntry) => void;
  onEdit: (entry: FsEntry) => void;
  onDownload: (entry: FsEntry) => void;
  onRename: (entry: FsEntry) => void;
  onCopyTo: (entries: FsEntry[]) => void;
  onMoveTo: (entries: FsEntry[]) => void;
  onCompress: (entries: FsEntry[], defaultName: string) => void;
  onExtract: (entry: FsEntry) => void;
  onChecksum: (entry: FsEntry) => void;
  onChmod: (entry: FsEntry) => void;
  onProps: (entry: FsEntry) => void;
  /** 已含删除确认弹窗 */
  onDelete: (paths: string[]) => void;
  onUploadTo: (dirPath: string) => void;
}
