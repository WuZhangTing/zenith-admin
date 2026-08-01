import { useCallback, useState } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { request } from '@/utils/request';

/** 导出当前会话聊天记录（自 ChatPage 原样搬移：state + handler） */
export function useExportChat() {
  // 导出当前会话聊天记录（走导出中心，xlsx 同步下载）
  const [exportingChat, setExportingChat] = useState(false);
  const handleExportChat = useCallback(async (convId: number) => {
    setExportingChat(true);
    try {
      const res = await request.post<{ job: { id: number; status: string; fileId: string | null; filename: string | null }; mode: string }>('/api/export-jobs', {
        entity: 'chat.messages', format: 'xlsx', query: { conversationId: convId }, raw: false, watermark: true, executionMode: 'sync',
      });
      if (res.code !== 0) return;
      if (!res.data) { Toast.error('导出失败'); return; }
      const { job, mode } = res.data;
      if (job.status === 'success' && job.fileId) {
        await request.download(`/api/export-jobs/${job.id}/download`, job.filename ?? '聊天记录.xlsx');
        Toast.success('导出完成');
        return;
      }
      Toast.success(mode === 'async' ? '导出任务已提交，可在导出中心查看进度' : '导出任务已创建');
    } finally {
      setExportingChat(false);
    }
  }, []);

  return { exportingChat, handleExportChat };
}
