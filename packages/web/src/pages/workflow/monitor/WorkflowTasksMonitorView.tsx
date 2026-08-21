/**
 * 任务监控 Tab（流程监控页）— 跨实例的任务粒度运维视图。
 * 字段对齐审批平台惯例：流程 / 发起人 / 发起时间 / 当前任务 / 任务起止时间 / 审批人 /
 * 审批状态 / 审批建议 / 耗时 / 流程编号 / 任务编号；行操作：详情（实例详情抽屉）/ 催办。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DatePicker, Input, Select, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Search } from 'lucide-react';
import type { WorkflowTaskMonitorItem } from '@zenith/shared/workflow';
import ConfigurableTable from '@/components/ConfigurableTable';
import { SearchToolbar } from '@/components/SearchToolbar';
import { StatCard, StatGrid } from '@/components/charts/StatCard';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import {
  WORKFLOW_TASK_NODE_TYPE_OPTIONS, formatTaskStayDuration,
  taskAssigneeColumn, taskIdColumn, taskNodeColumn, taskStatusColumn,
} from '@/components/workflow/workflow-task-columns';
import { useListSearch } from '@/hooks/useListSearch';
import { usePermission } from '@/hooks/usePermission';
import { useWorkflowTaskMonitorList, workflowMonitorKeys, type WorkflowTaskMonitorParams } from '@/hooks/queries/workflow-monitor';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { formatDateTimeRangeForApi } from '@/utils/date';
import { dateTimeColumn } from '@/utils/table-columns';

const STUCK_OPTIONS = [
  { value: 30, label: '停留 > 30 分钟' },
  { value: 120, label: '停留 > 2 小时' },
  { value: 1440, label: '停留 > 24 小时' },
];

interface SearchParams {
  keyword: string;
  assigneeKeyword: string;
  status: string;
  nodeType: string;
  stuckMinutes: number | '';
  createdRange: Date[] | undefined;
}

const defaultSearchParams: SearchParams = {
  keyword: '', assigneeKeyword: '', status: '', nodeType: '', stuckMinutes: '', createdRange: undefined,
};

interface Props {
  readonly onOpenInstance: (instanceId: number) => void;
}

export default function WorkflowTasksMonitorView({ onOpenInstance }: Props) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, applySearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: workflowMonitorKeys.taskMonitorLists });

  const { startTime, endTime } = formatDateTimeRangeForApi(submittedParams.createdRange);
  const params: WorkflowTaskMonitorParams = {
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    assigneeKeyword: submittedParams.assigneeKeyword || undefined,
    status: submittedParams.status || undefined,
    nodeType: submittedParams.nodeType || undefined,
    stuckMinutes: submittedParams.stuckMinutes === '' ? undefined : submittedParams.stuckMinutes,
    startTime,
    endTime,
  };
  const listQuery = useWorkflowTaskMonitorList(params);
  const data = listQuery.data ?? null;
  const stats = data?.stats ?? { total: 0, pending: 0, waiting: 0, approved: 0, rejected: 0, skipped: 0 };
  const statValue = (v: number) => (listQuery.isLoading ? '—' : v);

  const urgeMutation = useMutation({
    // 必须 unwrap：非 0 code（如 429 催办限频）需抛错走全局错误提示，否则会同时弹「已催办」
    mutationFn: (taskId: number) => request.post<unknown>(`/api/workflows/tasks/${taskId}/urge`, {}).then(unwrap),
    onSuccess: () => {
      Toast.success('已催办');
      void queryClient.invalidateQueries({ queryKey: workflowMonitorKeys.taskMonitorLists });
    },
  });

  const handleStatCardClick = (status: string) => {
    applySearch({ ...draftParams, status: draftParams.status === status ? '' : status });
  };

  const columns: ColumnProps<WorkflowTaskMonitorItem>[] = [
    taskIdColumn<WorkflowTaskMonitorItem>('任务编号', 90),
    {
      title: '流程',
      dataIndex: 'instanceTitle',
      width: 260,
      render: (v: string, r) => (
        <div>
          <Typography.Text link onClick={() => onOpenInstance(r.instanceId)} style={{ display: 'block' }}>{v}</Typography.Text>
          <Typography.Text type="tertiary" size="small">{r.definitionName ?? '—'} · {r.serialNo ?? `#${r.instanceId}`}</Typography.Text>
        </div>
      ),
    },
    { title: '发起人', dataIndex: 'initiatorName', width: 110, render: (v: string | null) => v ?? '—' },
    dateTimeColumn('发起时间', 'instanceCreatedAt'),
    taskNodeColumn<WorkflowTaskMonitorItem>({ title: '当前任务', width: 200, withTypeTag: true }),
    dateTimeColumn('任务开始时间', 'createdAt'),
    dateTimeColumn('任务结束时间', 'actionAt'),
    taskAssigneeColumn<WorkflowTaskMonitorItem>('审批人'),
    taskStatusColumn<WorkflowTaskMonitorItem>('审批状态'),
    { title: '审批建议', dataIndex: 'comment', width: 200, ellipsis: { showTitle: true }, render: (v: string | null) => v ?? '—' },
    {
      title: '耗时',
      dataIndex: 'stayedSec',
      width: 110,
      align: 'right',
      render: (v: number | null, r) => (
        <span style={{ color: (r.status === 'pending' || r.status === 'waiting') && v != null && v > 86_400 ? 'var(--semi-color-danger)' : 'var(--semi-color-text-1)' }}>
          {formatTaskStayDuration(v)}
        </span>
      ),
    },
    createOperationColumn<WorkflowTaskMonitorItem>({
      width: 150,
      desktopInlineKeys: ['detail', 'urge'],
      actions: (record) => [
        { key: 'detail', label: '详情', onClick: () => onOpenInstance(record.instanceId) },
        {
          key: 'urge',
          label: '催办',
          hidden: record.status !== 'pending' || !hasPermission('workflow:instance:monitor'),
          onClick: () => urgeMutation.mutate(record.id),
        },
      ],
    }),
  ];

  return (
    <>
      <StatGrid minItemWidth={120} style={{ marginBottom: 16 }}>
        <StatCard title="全部" value={statValue(stats.total ?? 0)} accent="var(--semi-color-text-0)" onClick={() => handleStatCardClick('')} active={draftParams.status === ''} />
        <StatCard title="待处理" value={statValue(stats.pending ?? 0)} accent="var(--semi-color-primary)" onClick={() => handleStatCardClick('pending')} active={draftParams.status === 'pending'} />
        <StatCard title="等待中" value={statValue(stats.waiting ?? 0)} accent="var(--semi-color-warning)" onClick={() => handleStatCardClick('waiting')} active={draftParams.status === 'waiting'} />
        <StatCard title="已通过" value={statValue(stats.approved ?? 0)} accent="#0dc87c" onClick={() => handleStatCardClick('approved')} active={draftParams.status === 'approved'} />
        <StatCard title="已驳回" value={statValue(stats.rejected ?? 0)} accent="#ff4d4f" onClick={() => handleStatCardClick('rejected')} active={draftParams.status === 'rejected'} />
        <StatCard title="已跳过" value={statValue(stats.skipped ?? 0)} accent="#8b5cf6" onClick={() => handleStatCardClick('skipped')} active={draftParams.status === 'skipped'} />
      </StatGrid>

      <SearchToolbar>
        <Input
          prefix={<Search size={14} />}
          placeholder="流程名称 / 申请标题"
          value={draftParams.keyword}
          onChange={(v) => setDraftParams((prev) => ({ ...prev, keyword: v }))}
          showClear
          style={{ width: 200 }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
        />
        <Input
          placeholder="审批人"
          value={draftParams.assigneeKeyword}
          onChange={(v) => setDraftParams((prev) => ({ ...prev, assigneeKeyword: v }))}
          showClear
          style={{ width: 130 }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
        />
        <Select
          placeholder="节点类型"
          showClear
          value={draftParams.nodeType || undefined}
          onChange={(v) => setDraftParams((prev) => ({ ...prev, nodeType: (v as string) ?? '' }))}
          style={{ width: 120 }}
          optionList={WORKFLOW_TASK_NODE_TYPE_OPTIONS}
        />
        <Select
          placeholder="停留时长"
          showClear
          value={draftParams.stuckMinutes === '' ? undefined : draftParams.stuckMinutes}
          onChange={(v) => setDraftParams((prev) => ({ ...prev, stuckMinutes: (v as number) ?? '' }))}
          style={{ width: 150 }}
          optionList={STUCK_OPTIONS}
        />
        <DatePicker
          type="dateTimeRange"
          placeholder={['创建时间起', '创建时间止']}
          value={draftParams.createdRange}
          onChange={(v) => setDraftParams((prev) => ({ ...prev, createdRange: Array.isArray(v) ? (v as Date[]) : undefined }))}
          style={{ width: 360 }}
        />
        <SearchButton onClick={handleSearch} />
        <ResetButton onClick={handleReset} />
      </SearchToolbar>

      <ConfigurableTable<WorkflowTaskMonitorItem>
        bordered
        loading={listQuery.isFetching}
        rowKey="id"
        dataSource={data?.list ?? []}
        columns={columns}
        pagination={buildPagination(data?.total ?? 0)}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        scroll={{ x: 1950 }}
      />
    </>
  );
}
