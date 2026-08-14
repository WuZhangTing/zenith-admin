import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Form, Select, Space, Spin, Switch, Tabs, TabPane, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { AppModal } from '@/components/AppModal';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import {
  paymentWebhookKeys,
  useDeletePaymentWebhookEndpoints,
  usePaymentWebhookDeliveries,
  usePaymentWebhookEndpointDetail,
  usePaymentWebhookEndpoints,
  useRedeliverPaymentWebhookDelivery,
  useSavePaymentWebhookEndpoint,
} from '@/hooks/queries/payment-webhooks';
import { PAYMENT_WEBHOOK_DELIVERY_STATUS_LABELS } from '@zenith/shared/payment';
import type { PaymentWebhookDelivery, PaymentWebhookEndpoint } from '@zenith/shared/payment';
import { useDictItems } from '@/hooks/useDictItems';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';
import { dateTimeColumn } from '@/utils/table-columns';
import { JsonBlock } from '@/components/JsonBlock';

const EVENT_OPTIONS = [
  { value: 'payment.succeeded', label: '支付成功' },
  { value: 'payment.closed', label: '支付关闭' },
  { value: 'payment.failed', label: '支付失败' },
  { value: 'refund.succeeded', label: '退款成功' },
  { value: 'refund.failed', label: '退款失败' },
];
const DELIVERY_STATUS_COLOR = { pending: 'grey', success: 'green', failed: 'red' } as const satisfies Record<PaymentWebhookDelivery['status'], string>;

interface EndpointSearchParams { keyword: string; status: string; }
const defaultEndpointSearch: EndpointSearchParams = { keyword: '', status: '' };

interface DeliverySearchParams { keyword: string; status: string; }
const defaultDeliverySearch: DeliverySearchParams = { keyword: '', status: '' };

interface EndpointFormValues {
  name: string;
  url: string;
  bizType?: string;
  events?: string[];
  status?: 'enabled' | 'disabled';
  secret?: string;
  remark?: string;
}

function formatRaw(raw: unknown): string {
  if (raw == null || raw === '') return '（无）';
  if (typeof raw !== 'string') return JSON.stringify(raw, null, 2) ?? String(raw);
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

export default function PaymentWebhooksPage() {
  const { items: statusItems } = useDictItems('common_status');
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'endpoints' | 'deliveries'>('endpoints');

  const {
    page: endpointPage,
    pageSize: endpointPageSize,
    setPage: setEndpointPage,
    buildPagination: buildEndpointPagination,
  } = usePagination();
  const [endpointSearch, setEndpointSearch] = useState<EndpointSearchParams>(defaultEndpointSearch);
  const [submittedEndpointSearch, setSubmittedEndpointSearch] = useState<EndpointSearchParams>(defaultEndpointSearch);

  const {
    page: deliveryPage,
    pageSize: deliveryPageSize,
    setPage: setDeliveryPage,
    buildPagination: buildDeliveryPagination,
  } = usePagination();
  const [deliverySearch, setDeliverySearch] = useState<DeliverySearchParams>(defaultDeliverySearch);
  const [submittedDeliverySearch, setSubmittedDeliverySearch] = useState<DeliverySearchParams>(defaultDeliverySearch);

  const [detailDelivery, setDetailDelivery] = useState<PaymentWebhookDelivery | null>(null);

  const endpointQuery = usePaymentWebhookEndpoints({
    page: endpointPage,
    pageSize: endpointPageSize,
    keyword: submittedEndpointSearch.keyword || undefined,
    status: submittedEndpointSearch.status || undefined,
  });
  const endpointData = endpointQuery.data?.list ?? [];
  const endpointTotal = endpointQuery.data?.total ?? 0;
  const deliveryQuery = usePaymentWebhookDeliveries({
    page: deliveryPage,
    pageSize: deliveryPageSize,
    keyword: submittedDeliverySearch.keyword || undefined,
    status: submittedDeliverySearch.status || undefined,
  });
  const deliveryData = deliveryQuery.data?.list ?? [];
  const deliveryTotal = deliveryQuery.data?.total ?? 0;
  const saveEndpointMutation = useSavePaymentWebhookEndpoint();
  const endpointModal = useEditModal<PaymentWebhookEndpoint, EndpointFormValues, Partial<PaymentWebhookEndpoint>>({
    entityName: 'Webhook 端点',
    save: saveEndpointMutation,
    useDetail: usePaymentWebhookEndpointDetail,
    defaults: { status: 'enabled', events: [] },
    toValues: (record) => ({
      name: record.name,
      url: record.url,
      bizType: record.bizType ?? '',
      events: record.events ?? [],
      status: record.status,
      secret: '',
      remark: record.remark ?? '',
    }),
    beforeSave: (values) => ({
      ...values,
      bizType: values.bizType || undefined,
      events: values.events ?? [],
      secret: values.secret || undefined,
      remark: values.remark || undefined,
    }),
    labelWidth: 96,
  });
  const toggleEndpointMutation = useSavePaymentWebhookEndpoint();
  const deleteEndpointMutation = useDeletePaymentWebhookEndpoints();
  const redeliverMutation = useRedeliverPaymentWebhookDelivery();
  const togglingId = toggleEndpointMutation.isPending ? (toggleEndpointMutation.variables?.id ?? null) : null;
  const redeliveringId = redeliverMutation.isPending ? (redeliverMutation.variables ?? null) : null;

  function handleEndpointSearch() { setEndpointPage(1); setSubmittedEndpointSearch(endpointSearch); void queryClient.invalidateQueries({ queryKey: paymentWebhookKeys.endpointLists }); }
  function handleEndpointReset() { setEndpointSearch(defaultEndpointSearch); setEndpointPage(1); setSubmittedEndpointSearch(defaultEndpointSearch); void queryClient.invalidateQueries({ queryKey: paymentWebhookKeys.endpointLists }); }
  function handleDeliverySearch() { setDeliveryPage(1); setSubmittedDeliverySearch(deliverySearch); void queryClient.invalidateQueries({ queryKey: paymentWebhookKeys.deliveryLists }); }
  function handleDeliveryReset() { setDeliverySearch(defaultDeliverySearch); setDeliveryPage(1); setSubmittedDeliverySearch(defaultDeliverySearch); void queryClient.invalidateQueries({ queryKey: paymentWebhookKeys.deliveryLists }); }

  async function handleToggle(record: PaymentWebhookEndpoint, checked: boolean) {
    await toggleEndpointMutation.mutateAsync({ id: record.id, values: { status: checked ? 'enabled' : 'disabled' } });
    Toast.success(checked ? '已启用' : '已停用');
  }

  async function handleDelete(id: number) {
    await deleteEndpointMutation.mutateAsync([id]);
    Toast.success('删除成功');
  }

  async function handleRedeliver(record: PaymentWebhookDelivery) {
    await redeliverMutation.mutateAsync(record.id);
    Toast.success('重投成功');
  }

  const endpointColumns: ColumnProps<PaymentWebhookEndpoint>[] = [
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: 'URL', dataIndex: 'url', width: 260, render: (v: string) => <Typography.Text ellipsis={{ showTooltip: true }} copyable={{ content: v }} style={{ maxWidth: 240 }}>{v}</Typography.Text> },
    { title: '业务类型', dataIndex: 'bizType', width: 120, render: (v: string | null) => v || '全部' },
    { title: '事件', dataIndex: 'events', width: 260, render: (v: string[]) => (v.length ? <Space wrap>{v.map((e) => <Tag key={e} color="blue">{EVENT_OPTIONS.find((o) => o.value === e)?.label ?? e}</Tag>)}</Space> : '全部事件') },
    { title: '密钥', dataIndex: 'hasSecret', width: 90, render: (v: boolean) => (v ? '已配置' : '-') },
    dateTimeColumn('创建时间', 'createdAt'),
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (_: unknown, r: PaymentWebhookEndpoint) => (
        <Switch checked={r.status === 'enabled'} loading={togglingId === r.id} disabled={!hasPermission('payment:webhook:update')} size="small" onChange={(c) => void handleToggle(r, c)} />
      ),
    },
    createOperationColumn<PaymentWebhookEndpoint>({
      width: 130,
      actions: (r) => [
        ...(hasPermission('payment:webhook:update') ? [{
          key: 'edit',
          label: '编辑',
          onClick: () => endpointModal.openEdit(r),
        }] : []),
        ...(hasPermission('payment:webhook:delete') ? [{
          key: 'delete',
          label: '删除',
          danger: true,
          onClick: () => {
            confirmDelete({
              content: '删除后不可恢复',
              onOk: () => handleDelete(r.id),
            });
          },
        }] : []),
      ],
    }),
  ];

  const deliveryColumns: ColumnProps<PaymentWebhookDelivery>[] = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '端点', dataIndex: 'endpointName', width: 160, render: (v: string | null) => v || '-' },
    { title: '事件类型', dataIndex: 'eventType', width: 160 },
    { title: '订单号', dataIndex: 'orderNo', width: 180, render: (v: string | null) => v || '-' },
    { title: '次数', dataIndex: 'attempts', width: 80 },
    { title: 'HTTP', dataIndex: 'httpStatus', width: 90, render: (v: number | null) => v ?? '-' },
    dateTimeColumn('创建时间', 'createdAt'),
    { title: '状态', dataIndex: 'status', width: 90, fixed: 'right', render: (v: PaymentWebhookDelivery['status']) => <Tag color={DELIVERY_STATUS_COLOR[v]}>{PAYMENT_WEBHOOK_DELIVERY_STATUS_LABELS[v]}</Tag> },
    createOperationColumn<PaymentWebhookDelivery>({
      width: 120,
      actions: (r) => [
        {
          key: 'detail',
          label: '详情',
          onClick: () => setDetailDelivery(r),
        },
        ...(r.status !== 'success' ? [{
          key: 'redeliver',
          label: '重投',
          loading: redeliveringId === r.id,
          onClick: () => void handleRedeliver(r),
        }] : []),
      ],
    }),
  ];

  const renderEndpointKeywordSearch = () => (
    <KeywordInput placeholder="名称/URL..." value={endpointSearch.keyword} onChange={(v) => setEndpointSearch((p) => ({ ...p, keyword: v }))} onSearch={handleEndpointSearch} width={200} />
  );
  const renderEndpointStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={endpointSearch.status || undefined}
      onChange={(v) => setEndpointSearch((p) => ({ ...p, status: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))}
    />
  );
  const renderEndpointSearchButton = () => <SearchButton onClick={handleEndpointSearch} />;
  const renderEndpointResetButton = () => <ResetButton onClick={handleEndpointReset} />;
  const renderEndpointCreateButton = () => hasPermission('payment:webhook:create') ? (
    <CreateButton onClick={endpointModal.openCreate} />
  ) : null;

  const renderDeliveryKeywordSearch = () => (
    <KeywordInput placeholder="订单号..." value={deliverySearch.keyword} onChange={(v) => setDeliverySearch((p) => ({ ...p, keyword: v }))} onSearch={handleDeliverySearch} width={200} />
  );
  const renderDeliveryStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={deliverySearch.status || undefined}
      onChange={(v) => setDeliverySearch((p) => ({ ...p, status: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={Object.entries(PAYMENT_WEBHOOK_DELIVERY_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
    />
  );
  const renderDeliverySearchButton = () => <SearchButton onClick={handleDeliverySearch} />;
  const renderDeliveryResetButton = () => <ResetButton onClick={handleDeliveryReset} />;

  return (
    <div className="page-container page-tabs-page">
      <Tabs collapsible="auto" activeKey={activeTab} onChange={(k) => setActiveTab(k as 'endpoints' | 'deliveries')} type="line" lazyRender keepDOM={false}>
        <TabPane tab="端点配置" itemKey="endpoints">
          <SearchToolbar
            primary={(
              <>
                {renderEndpointKeywordSearch()}
                {renderEndpointStatusFilter()}
                {renderEndpointSearchButton()}
                {renderEndpointResetButton()}
                {renderEndpointCreateButton()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderEndpointKeywordSearch()}
                {renderEndpointSearchButton()}
                {renderEndpointCreateButton()}
              </>
            )}
            mobileFilters={renderEndpointStatusFilter()}
            filterTitle="Webhook 端点筛选"
            onFilterApply={handleEndpointSearch}
            onFilterReset={handleEndpointReset}
          />
          <ConfigurableTable
            bordered columns={endpointColumns} dataSource={endpointData} loading={endpointQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void endpointQuery.refetch()} refreshLoading={endpointQuery.isFetching} pagination={buildEndpointPagination(endpointTotal)}
          />
        </TabPane>
        <TabPane tab="投递日志" itemKey="deliveries">
          <SearchToolbar
            primary={(
              <>
                {renderDeliveryKeywordSearch()}
                {renderDeliveryStatusFilter()}
                {renderDeliverySearchButton()}
                {renderDeliveryResetButton()}
              </>
            )}
            mobilePrimary={(
              <>
                {renderDeliveryKeywordSearch()}
                {renderDeliverySearchButton()}
              </>
            )}
            mobileFilters={renderDeliveryStatusFilter()}
            filterTitle="Webhook 投递筛选"
            onFilterApply={handleDeliverySearch}
            onFilterReset={handleDeliveryReset}
          />
          <ConfigurableTable
            bordered columns={deliveryColumns} dataSource={deliveryData} loading={deliveryQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
            onRefresh={() => void deliveryQuery.refetch()} refreshLoading={deliveryQuery.isFetching} pagination={buildDeliveryPagination(deliveryTotal)}
          />
        </TabPane>
      </Tabs>

      <AppModal {...endpointModal.modalProps} width={680}>
        <Spin spinning={endpointModal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form {...endpointModal.formProps}>
            <Form.Input field="name" label="名称" placeholder="如：订单系统回调" rules={[{ required: true, message: '名称不能为空' }]} />
            <Form.Input field="url" label="URL" placeholder="https://example.com/payment/webhook" rules={[{ required: true, message: 'URL 不能为空' }]} />
            <Form.Input field="bizType" label="业务类型" placeholder="留空=全部" />
            <Form.Select field="events" label="事件" multiple maxTagCount={3} style={{ width: '100%' }} optionList={EVENT_OPTIONS} placeholder="留空=全部事件" />
            <Form.Select field="status" label="状态" style={{ width: '100%' }} optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))} />
            <Form.Input field="secret" label="密钥" mode="password" placeholder={endpointModal.editing?.hasSecret ? '已配置，留空则不修改' : '请输入'} />
            <Form.TextArea field="remark" label="备注" autosize rows={1} placeholder="可选" />
          </Form>
        </Spin>
      </AppModal>

      <AppModal title={`投递详情（#${detailDelivery?.id ?? ''}）`} visible={!!detailDelivery} onCancel={() => setDetailDelivery(null)} footer={null} width={760} closeOnEsc>
        {detailDelivery && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>Payload</Typography.Text>
              <JsonBlock value={formatRaw(detailDelivery.payload)} />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>Response Body</Typography.Text>
              <JsonBlock value={formatRaw(detailDelivery.responseBody)} />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>Last Error</Typography.Text>
              <JsonBlock value={formatRaw(detailDelivery.lastError)} />
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
}
