import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Modal,
  Select,
  SideSheet,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { CircleOff, Plus, RotateCcw, Search, Send, Trash2 } from 'lucide-react';
import {
  CMS_WIDGET_STATUS_LABELS,
  CMS_WIDGET_TYPE_LABELS,
  type CmsWidget,
  type CmsWidgetRef,
  type CmsWidgetStatus,
  type CmsWidgetType,
} from '@zenith/shared';
import ConfigurableTable from '@/components/ConfigurableTable';
import AsyncTaskProgress from '@/components/AsyncTaskProgress';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { usePermission } from '@/hooks/usePermission';
import { usePagination } from '@/hooks/usePagination';
import { useMyAsyncTasks } from '@/hooks/useAsyncTasks';
import {
  cmsWidgetKeys,
  useCmsWidgetBatch,
  useCmsWidgetList,
  useCmsWidgetRefs,
  useDeleteCmsWidget,
  useOfflineCmsWidget,
  usePublishCmsWidget,
} from '@/hooks/queries/cms-widgets';
import { renderEllipsis } from '@/utils/table-columns';
import { CmsSiteSelect } from './CmsSiteSelect';

interface SearchState {
  keyword: string;
  status: '' | CmsWidgetStatus;
  type: '' | CmsWidgetType;
}

const DEFAULT_SEARCH: SearchState = { keyword: '', status: '', type: '' };

const STATUS_COLOR: Record<CmsWidgetStatus, 'grey' | 'green' | 'orange'> = {
  draft: 'grey',
  published: 'green',
  offline: 'orange',
};

export default function WidgetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();
  const { page, pageSize, resetPage, buildPagination } = usePagination();
  const [siteId, setSiteId] = useState<number | undefined>();
  const [draft, setDraft] = useState<SearchState>(DEFAULT_SEARCH);
  const [submitted, setSubmitted] = useState<SearchState>(DEFAULT_SEARCH);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [refsWidget, setRefsWidget] = useState<CmsWidget | null>(null);

  const listQuery = useCmsWidgetList({
    page,
    pageSize,
    siteId,
    keyword: submitted.keyword || undefined,
    status: submitted.status || undefined,
    type: submitted.type || undefined,
  });
  const refsQuery = useCmsWidgetRefs(refsWidget?.id, !!refsWidget);
  const publishMutation = usePublishCmsWidget();
  const offlineMutation = useOfflineCmsWidget();
  const deleteMutation = useDeleteCmsWidget();
  const batchMutation = useCmsWidgetBatch();
  const { tasks } = useMyAsyncTasks({ taskTypes: ['cms-widget-batch', 'cms-widget-refresh'] });
  const activeTasks = tasks.filter((task) => ['pending', 'running', 'retrying'].includes(task.status));

  function handleSearch() {
    resetPage();
    setSubmitted({ ...draft, keyword: draft.keyword.trim() });
    void queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.lists });
  }

  function handleReset() {
    resetPage();
    setDraft(DEFAULT_SEARCH);
    setSubmitted(DEFAULT_SEARCH);
    void queryClient.invalidateQueries({ queryKey: cmsWidgetKeys.lists });
  }

  async function runSingle(action: 'publish' | 'offline', id: number) {
    if (action === 'publish') {
      await publishMutation.mutateAsync(id);
      Toast.success('发布成功，引用刷新任务已提交');
    } else {
      await offlineMutation.mutateAsync(id);
      Toast.success('下线成功，引用刷新任务已提交');
    }
  }

  function confirmDelete(widget: CmsWidget) {
    Modal.confirm({
      title: `删除页面部件「${widget.name}」？`,
      content: widget.referenceCount > 0
        ? `该部件仍有 ${widget.referenceCount} 个引用，无法删除。`
        : '删除后不可恢复。',
      okButtonProps: { type: 'danger', theme: 'solid', disabled: widget.referenceCount > 0 },
      onOk: async () => {
        await deleteMutation.mutateAsync(widget.id);
        Toast.success('删除成功');
      },
    });
  }

  function submitBatch(action: 'publish' | 'offline' | 'delete') {
    if (selectedIds.length === 0) return;
    const label = action === 'publish' ? '发布' : action === 'offline' ? '下线' : '删除';
    Modal.confirm({
      title: `批量${label} ${selectedIds.length} 个页面部件？`,
      content: action === 'delete' ? '仍被引用的部件会在任务明细中标记失败。' : '操作将在任务中心异步执行。',
      okButtonProps: action === 'delete' ? { type: 'danger', theme: 'solid' } : undefined,
      onOk: async () => {
        await batchMutation.mutateAsync({ ids: selectedIds, action });
        setSelectedIds([]);
        Toast.success('批量任务已提交');
      },
    });
  }

  const columns: ColumnProps<CmsWidget>[] = [
    { title: '部件名称', dataIndex: 'name', width: 190, render: renderEllipsis },
    { title: '编码', dataIndex: 'code', width: 180, render: renderEllipsis },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (value: CmsWidgetType) => CMS_WIDGET_TYPE_LABELS[value],
    },
    {
      title: '线上修订',
      width: 110,
      render: (_value: unknown, record) => (
        <span>
          {record.publishedRevision || '—'}
          {record.hasUnpublishedChanges ? <Tag size="small" color="blue" style={{ marginLeft: 6 }}>有草稿</Tag> : null}
        </span>
      ),
    },
    { title: '引用数', dataIndex: 'referenceCount', width: 90 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      fixed: 'right',
      render: (value: CmsWidgetStatus) => (
        <Tag size="small" color={STATUS_COLOR[value]}>{CMS_WIDGET_STATUS_LABELS[value]}</Tag>
      ),
    },
    createOperationColumn<CmsWidget>({
      width: 250,
      desktopInlineKeys: ['edit', 'publish'],
      actions: (record) => [
        {
          key: 'edit',
          label: '编辑',
          hidden: !hasPermission('cms:widget:update'),
          onClick: () => navigate(`/cms/widgets/edit?id=${record.id}&siteId=${record.siteId}`),
        },
        {
          key: 'publish',
          label: '发布',
          hidden: !hasPermission('cms:widget:publish'),
          loading: publishMutation.isPending && publishMutation.variables === record.id,
          onClick: () => runSingle('publish', record.id),
        },
        {
          key: 'offline',
          label: '下线',
          hidden: record.status !== 'published' || !hasPermission('cms:widget:offline'),
          loading: offlineMutation.isPending && offlineMutation.variables === record.id,
          onClick: () => runSingle('offline', record.id),
        },
        {
          key: 'refs',
          label: `引用（${record.referenceCount}）`,
          onClick: () => setRefsWidget(record),
        },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !hasPermission('cms:widget:delete'),
          disabled: record.referenceCount > 0,
          disabledReason: record.referenceCount > 0 ? '请先解除所有页面和主题插槽引用' : undefined,
          onClick: () => confirmDelete(record),
        },
      ],
    }),
  ];

  const keywordInput = (
    <Input
      prefix={<Search size={14} />}
      placeholder="部件名称 / 编码"
      value={draft.keyword}
      onChange={(keyword) => setDraft((current) => ({ ...current, keyword }))}
      onEnterPress={handleSearch}
      showClear
      style={{ width: 220 }}
    />
  );
  const statusFilter = (
    <Select
      placeholder="全部状态"
      value={draft.status || undefined}
      onChange={(value) => setDraft((current) => ({ ...current, status: (value as CmsWidgetStatus) ?? '' }))}
      showClear
      style={{ width: 130 }}
      optionList={Object.entries(CMS_WIDGET_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
    />
  );
  const typeFilter = (
    <Select
      placeholder="全部类型"
      value={draft.type || undefined}
      onChange={(value) => setDraft((current) => ({ ...current, type: (value as CmsWidgetType) ?? '' }))}
      showClear
      style={{ width: 140 }}
      optionList={Object.entries(CMS_WIDGET_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
    />
  );

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            <CmsSiteSelect value={siteId} onChange={(value) => { setSiteId(value); resetPage(); setSelectedIds([]); }} />
            {keywordInput}
            {statusFilter}
            {typeFilter}
            <Button type="primary" icon={<Search size={14} />} onClick={handleSearch}>查询</Button>
            <Button type="tertiary" icon={<RotateCcw size={14} />} onClick={handleReset}>重置</Button>
          </>
        )}
        actions={(
          <>
            {selectedIds.length > 0 && hasPermission('cms:widget:publish') ? (
              <Button icon={<Send size={14} />} onClick={() => submitBatch('publish')}>批量发布（{selectedIds.length}）</Button>
            ) : null}
            {selectedIds.length > 0 && hasPermission('cms:widget:offline') ? (
              <Button icon={<CircleOff size={14} />} onClick={() => submitBatch('offline')}>批量下线</Button>
            ) : null}
            {selectedIds.length > 0 && hasPermission('cms:widget:delete') ? (
              <Button type="danger" theme="light" icon={<Trash2 size={14} />} onClick={() => submitBatch('delete')}>批量删除</Button>
            ) : null}
            {hasPermission('cms:widget:create') ? (
              <Button
                type="primary"
                icon={<Plus size={14} />}
                disabled={!siteId}
                onClick={() => navigate(`/cms/widgets/edit?siteId=${siteId}`)}
              >
                新增
              </Button>
            ) : null}
          </>
        )}
        mobilePrimary={(
          <>
            <CmsSiteSelect value={siteId} onChange={(value) => { setSiteId(value); resetPage(); setSelectedIds([]); }} width={150} />
            {keywordInput}
            <Button type="primary" icon={<Search size={14} />} onClick={handleSearch}>查询</Button>
          </>
        )}
        mobileFilters={<>{statusFilter}{typeFilter}</>}
        mobileActions={(
          <>
            {selectedIds.length > 0 ? <Button theme="borderless" onClick={() => submitBatch('publish')}>批量发布</Button> : null}
            {selectedIds.length > 0 ? <Button theme="borderless" onClick={() => submitBatch('offline')}>批量下线</Button> : null}
            {selectedIds.length > 0 ? <Button theme="borderless" type="danger" onClick={() => submitBatch('delete')}>批量删除</Button> : null}
          </>
        )}
        filterTitle="页面部件筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable<CmsWidget>
        bordered
        columns={columns}
        dataSource={listQuery.data?.list ?? []}
        loading={listQuery.isFetching}
        rowKey="id"
        empty={siteId ? '暂无页面部件' : '请先选择站点'}
        scroll={{ x: 1250 }}
        pagination={buildPagination(listQuery.data?.total ?? 0)}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds((keys ?? []).map(Number)),
        }}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
      />

      {activeTasks.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Typography.Title heading={6}>进行中的页面部件任务</Typography.Title>
          {activeTasks.map((task) => <AsyncTaskProgress key={task.id} task={task} />)}
        </div>
      ) : null}

      <SideSheet
        title={refsWidget ? `引用位置：${refsWidget.name}` : '引用位置'}
        visible={!!refsWidget}
        width={520}
        onCancel={() => setRefsWidget(null)}
      >
        <ConfigurableTable<CmsWidgetRef>
          bordered
          rowKey="id"
          columns={[
            {
              title: '类型',
              width: 100,
              render: (_value, record) => record.ownerType === 'page' ? '搭建页面' : '主题插槽',
            },
            { title: '位置', dataIndex: 'ownerName', width: 160, render: renderEllipsis },
            { title: '字段', dataIndex: 'field', width: 150, render: renderEllipsis },
          ]}
          dataSource={refsQuery.data ?? []}
          loading={refsQuery.isFetching}
          pagination={false}
          onRefresh={() => void refsQuery.refetch()}
          refreshLoading={refsQuery.isFetching}
        />
      </SideSheet>
    </div>
  );
}
