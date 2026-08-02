/** 在线编辑抽屉（Monaco，Ctrl+S 保存）：关闭前有未保存修改时二次确认 */
import { useRef } from 'react';
import { SideSheet, Typography } from '@douyinfe/semi-ui';
import { Pencil } from 'lucide-react';
import { confirmDanger } from '@/utils/confirm';
import EditorTab from '../../terminal/EditorTab';
import type { FsEntry } from '../types';

interface FmEditorSheetProps {
  readonly entry: FsEntry | null;
  readonly onClose: () => void;
}

export default function FmEditorSheet({ entry, onClose }: Readonly<FmEditorSheetProps>) {
  const dirtyRef = useRef(false);

  const handleCancel = () => {
    if (dirtyRef.current) {
      confirmDanger({
        title: '有未保存的修改',
        content: '关闭将丢弃未保存的内容（编辑器内 Ctrl+S 可保存），确定关闭吗？',
        okText: '丢弃并关闭',
        onOk: () => { dirtyRef.current = false; onClose(); },
      });
      return;
    }
    onClose();
  };

  return (
    <SideSheet
      title={
        entry ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={15} />
            <Typography.Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 480 }}>
              编辑 — {entry.name}
            </Typography.Text>
          </div>
        ) : '编辑'
      }
      visible={!!entry}
      onCancel={handleCancel}
      width="72%"
      style={{ maxWidth: 1100 }}
      bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column' }}
      closeOnEsc={false}
    >
      {entry && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <EditorTab
            filePath={entry.path}
            active
            onDirtyChange={(d) => { dirtyRef.current = d; }}
          />
        </div>
      )}
    </SideSheet>
  );
}
