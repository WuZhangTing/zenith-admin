/**
 * 通用导入按钮（与 ExportButton 对偶）。
 *
 * 交互：下载模板 / 选择 xlsx → 上传文件中心 → 提交导入任务 → 进度弹窗
 * （轮询任务 + 行级成败明细），全程不离开当前页面。
 * 完成后触发 onFinished（调用方失效列表查询）。
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Modal, Table, Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { ChevronDown, Upload } from 'lucide-react';
import type { AsyncTaskItem } from '@zenith/shared/tasks';
import AsyncTaskProgress from '@/components/AsyncTaskProgress';
import { useUploadFile } from '@/hooks/queries/files';
import { useAsyncTaskItems } from '@/hooks/queries/async-tasks';
import { downloadImportTemplate, useImportTaskPolling, useSubmitImportJob } from '@/hooks/queries/import-jobs';

const { Text } = Typography;

interface ImportButtonProps {
  /** 导入实体标识（服务端 Definition 的 entity），如 'member.members' */
  entity: string;
  /** 实体名（按钮文案与模板文件名） */
  title: string;
  label?: string;
  /** 导入任务终态后回调（成功与否都触发，调用方刷新列表） */
  onFinished?: () => void;
}

const ITEM_STATUS_META = {
  success: { label: '成功', color: 'green' },
  failed: { label: '失败', color: 'red' },
  skipped: { label: '跳过', color: 'grey' },
} as const;

export function ImportButton({ entity, title, label = '导入', onFinished }: Readonly<ImportButtonProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [itemPage, setItemPage] = useState(1);
  const finishedNotified = useRef(false);

  const uploadMutation = useUploadFile();
  const submitMutation = useSubmitImportJob();
  const taskQuery = useImportTaskPolling(taskId);
  const task = taskQuery.data ?? null;
  const isTerminal = task ? ['success', 'failed', 'cancelled'].includes(task.status) : false;
  const itemsQuery = useAsyncTaskItems({ taskId: taskId ?? 0, page: itemPage, pageSize: 8 }, taskId !== null);

  // 行级明细跟随任务进度刷新（items 查询本身无轮询）
  const processedCount = task?.processedCount ?? 0;
  const refetchItems = itemsQuery.refetch;
  useEffect(() => {
    if (taskId !== null) void refetchItems();
  }, [taskId, processedCount, refetchItems]);

  // 终态回调（一次性）：调用方借此刷新业务列表
  useEffect(() => {
    if (isTerminal && !finishedNotified.current) {
      finishedNotified.current = true;
      onFinished?.();
    }
  }, [isTerminal, onFinished]);

  async function handleFileSelected(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const uploaded = await uploadMutation.mutateAsync({ formData });
    const fileId = Array.isArray(uploaded) ? uploaded[0]?.id : (uploaded as { id?: string })?.id;
    if (!fileId) return;
    const row = await submitMutation.mutateAsync({ entity, fileId });
    finishedNotified.current = false;
    setItemPage(1);
    setTaskId(row.id);
  }

  const itemColumns: ColumnProps<AsyncTaskItem>[] = [
    { title: '行', dataIndex: 'itemKey', width: 80 },
    { title: '内容', dataIndex: 'label', width: 160, ellipsis: true },
    {
      title: '结果', dataIndex: 'status', width: 80,
      render: (v: AsyncTaskItem['status']) => {
        const meta = ITEM_STATUS_META[v as keyof typeof ITEM_STATUS_META] ?? { label: v, color: 'grey' as const };
        return <Tag size="small" color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '说明', dataIndex: 'message', width: 220, ellipsis: { showTitle: false },
      render: (v: string | null) => v ? <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: '100%' }} size="small">{v}</Text> : '—',
    },
  ];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFileSelected(file);
        }}
      />
      <Dropdown
        trigger="click"
        position="bottomLeft"
        clickToHide
        render={(
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => fileInputRef.current?.click()}>上传文件导入</Dropdown.Item>
            <Dropdown.Item onClick={() => void downloadImportTemplate(entity, title)}>下载导入模板</Dropdown.Item>
          </Dropdown.Menu>
        )}
      >
        <Button
          icon={<Upload size={14} />}
          iconPosition="left"
          loading={uploadMutation.isPending || submitMutation.isPending}
        >
          {label} <ChevronDown size={12} style={{ verticalAlign: 'middle' }} />
        </Button>
      </Dropdown>

      <Modal
        title={`${title}导入`}
        visible={taskId !== null}
        onCancel={() => setTaskId(null)}
        footer={<Button type="primary" onClick={() => setTaskId(null)}>{isTerminal ? '完成' : '后台运行'}</Button>}
        width={640}
        maskClosable={false}
      >
        {task && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            <AsyncTaskProgress task={task} fluid />
            {task.errorMessage && <Text type="danger" size="small">{task.errorMessage}</Text>}
            <Table
              columns={itemColumns}
              dataSource={itemsQuery.data?.list ?? []}
              loading={itemsQuery.isFetching && !itemsQuery.data}
              rowKey="id"
              size="small"
              empty="暂无行级明细"
              pagination={{
                currentPage: itemPage,
                pageSize: 8,
                total: itemsQuery.data?.total ?? 0,
                onPageChange: setItemPage,
              }}
            />
            <Text type="tertiary" size="small">
              可关闭本窗口后台运行，稍后在「任务中心」查看进度与全部明细。
            </Text>
          </div>
        )}
      </Modal>
    </>
  );
}

export default ImportButton;
