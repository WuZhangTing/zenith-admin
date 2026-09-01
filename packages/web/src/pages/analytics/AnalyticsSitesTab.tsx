
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Form, Modal, Popconfirm, Select, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { AnalyticsSite } from '@zenith/shared/analytics';
import { ConfigurableTable } from '@/components/ConfigurableTable';
import { SearchToolbar } from '@/components/SearchToolbar';
import {
  analyticsKeys,
  useAnalyticsSites,
  useCreateSite,
  useDeleteSite,
  useRegenerateSiteKey,
  useUpdateSite,
} from '@/hooks/queries/analytics';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { useEditModal } from '@/hooks/useEditModal';
import { copyableNoColumn, dateTimeColumn } from '@/utils/table-columns';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: 'enabled', label: '启用' },
  { value: 'disabled', label: '停用' },
];
const STATUS_META: Record<AnalyticsSite['status'], { label: string; color: 'green' | 'red' }> = {
  enabled: { label: '启用', color: 'green' },
  disabled: { label: '停用', color: 'red' },
};

interface SearchState { name: string; status: '' | AnalyticsSite['status'] }
type SiteFormValues = {
  name: string;
  appId: string;
  allowedOrigins?: string[];
  dailyEventQuota?: number | null;
  status: AnalyticsSite['status'];
  remark?: string | null;
};

const defaultSearch: SearchState = { name: '', status: '' };

function normalizeForm(values: SiteFormValues) {
  return {
    name: values.name?.trim(),
    appId: values.appId?.trim(),
    allowedOrigins: values.allowedOrigins?.map((v) => v.trim()).filter(Boolean) ?? null,
    dailyEventQuota: values.dailyEventQuota ?? null,
    status: values.status ?? 'enabled',
    remark: values.remark?.trim() || null,
  };
}

function renderUsage(record: AnalyticsSite) {
  const usage = record.todayUsage ?? 0;
  if (record.dailyEventQuota == null) return <Typography.Text>{usage} / ∞</Typography.Text>;
  const ratio = record.dailyEventQuota > 0 ? usage / record.dailyEventQuota : 0;
  const content = `${usage} / ${record.dailyEventQuota}`;
  return ratio >= 0.9 ? <Tag color="red" size="small">{content}</Tag> : <Typography.Text>{content}</Typography.Text>;
}

export default function AnalyticsSitesTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [draft, setDraft] = useState<SearchState>(defaultSearch);
  const [submitted, setSubmitted] = useState<SearchState>(defaultSearch);

  const params = useMemo(() => ({ page, pageSize, name: submitted.name || undefined, status: submitted.status || undefined }), [page, pageSize, submitted]);
  const listQuery = useAnalyticsSites(params);
  const createMutation = useCreateSite();
  const updateMutation = useUpdateSite();
  const deleteMutation = useDeleteSite();
  const regenerateMutation = useRegenerateSiteKey();

  const data = listQuery.data;
  const list = data?.list ?? [];

  const handleSearch = () => {
    setPage(1);
    setSubmitted(draft);
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.data.sitesLists });
  };
  const handleReset = () => {
    setDraft(defaultSearch);
    setSubmitted(defaultSearch);
    setPage(1);
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.data.sitesLists });
  };
  const siteModal = useEditModal<AnalyticsSite, SiteFormValues, ReturnType<typeof normalizeForm>>({
    entityName: '站点',
    save: {
      mutateAsync: ({ id, values }) => (
        id ? updateMutation.mutateAsync({ id, values }) : createMutation.mutateAsync(values)
      ),
      isPending: createMutation.isPending || updateMutation.isPending,
    },
    defaults: { appId: 'admin', status: 'enabled', allowedOrigins: [] },
    toValues: (record) => ({
      name: record.name,
      appId: record.appId,
      allowedOrigins: record.allowedOrigins ?? [],
      dailyEventQuota: record.dailyEventQuota,
      status: record.status,
      remark: record.remark,
    }),
    beforeSave: normalizeForm,
    labelWidth: 110,
  });

  const columns: ColumnProps<AnalyticsSite>[] = [
    { title: '名称', dataIndex: 'name', width: 160, fixed: 'left' },
    copyableNoColumn('Site Key', 'siteKey', { width: 340 }),
    { title: 'AppId', dataIndex: 'appId', width: 120, render: (value: string) => <Tag size="small">{value}</Tag> },
    { title: '归属租户', dataIndex: 'tenantName', width: 140, render: (_: unknown, record) => record.tenantName || '平台' },
    { title: '来源白名单', dataIndex: 'allowedOrigins', width: 220, render: (origins: string[] | null) => origins?.length ? <Space wrap>{origins.slice(0, 3).map((o) => <Tag key={o} size="small">{o}</Tag>)}{origins.length > 3 ? <Tag size="small">+{origins.length - 3}</Tag> : null}</Space> : '不限制' },
    { title: '日配额', dataIndex: 'dailyEventQuota', width: 110, align: 'right', render: (value: number | null) => value ?? '不限' },
    { title: '今日用量', dataIndex: 'todayUsage', width: 140, align: 'right', render: (_: number | null, record) => renderUsage(record) },
    dateTimeColumn('更新时间', 'updatedAt'),
    { title: '状态', dataIndex: 'status', width: 100, fixed: 'right', render: (value: AnalyticsSite['status']) => <Tag color={STATUS_META[value].color} size="small">{STATUS_META[value].label}</Tag> },
    {
      title: '操作', dataIndex: 'operation', width: 260, fixed: 'right', render: (_: unknown, record) => (
        <Space>
          <Button theme="borderless" size="small" onClick={() => siteModal.openEdit(record)}>编辑</Button>
          <Popconfirm title="确定重新生成 Key？旧 Key 将立即失效。" onConfirm={() => regenerateMutation.mutate(record.id)}>
            <Button theme="borderless" size="small" loading={regenerateMutation.isPending}>重新生成Key</Button>
          </Popconfirm>
          <Popconfirm title="确定要删除该站点吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button theme="borderless" type="danger" size="small" loading={deleteMutation.isPending}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <SearchToolbar>
        <KeywordInput placeholder="站点名称" value={draft.name} onChange={(name) => setDraft((prev) => ({ ...prev, name }))} />
        <Select placeholder="状态" value={draft.status || undefined} optionList={STATUS_OPTIONS} onChange={(status) => setDraft((prev) => ({ ...prev, status: (status as AnalyticsSite['status']) ?? '' }))} showClear style={{ width: 120 }} />
        <SearchButton onClick={handleSearch} />
        <ResetButton onClick={handleReset} />
        <CreateButton onClick={siteModal.openCreate} />
      </SearchToolbar>

      <ConfigurableTable
        bordered
        rowKey="id"
        loading={listQuery.isFetching}
        columns={columns}
        dataSource={list}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        scroll={{ x: 1770 }}
        pagination={{
          currentPage: page,
          pageSize,
          total: data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (next) => { setPage(1); setPageSize(next); },
        }}
        empty="暂无站点"
      />

      <Modal
        {...siteModal.modalProps}
        width={620}
      >
        <Form key={siteModal.formKey} {...siteModal.formProps}>
          <Form.Input field="name" label="站点名称" placeholder="如 管理后台" rules={[{ required: true, message: '请输入站点名称' }]} />
          <Form.Input field="appId" label="AppId" placeholder="如 admin/member" rules={[{ required: true, message: '请输入 appId' }, { pattern: /^[a-z][a-z0-9_-]*$/, message: '以小写字母开头，仅允许小写字母、数字、下划线和中划线' }]} />
          <Form.TagInput field="allowedOrigins" label="来源白名单" placeholder="输入 origin 后回车，如 https://example.com" />
          <Form.InputNumber field="dailyEventQuota" label="日事件配额" min={1} placeholder="留空表示不限" style={{ width: '100%' }} />
          <Form.Select field="status" label="状态" optionList={STATUS_OPTIONS} style={{ width: '100%' }} />
          <Form.TextArea field="remark" label="备注" maxCount={500} autosize={{ minRows: 3, maxRows: 5 }} />
        </Form>
      </Modal>
    </>
  );
}
