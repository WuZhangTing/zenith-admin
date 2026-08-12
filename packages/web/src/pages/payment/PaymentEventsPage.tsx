import { Col, Row, Select, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { usePermission } from '@/hooks/usePermission';
import type { PaymentOutboxEvent } from '@zenith/shared/payment';
import { paymentEventKeys, usePaymentEventList, usePaymentOpsHealth, useRedispatchPaymentEvent } from '@/hooks/queries/payment-events';
import { useListSearch } from '@/hooks/useListSearch';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { dateTimeColumn } from '@/utils/table-columns';

const EVENT_STATUS_LABELS = { pending: '待处理', done: '已完成', failed: '失败' } as const satisfies Record<PaymentOutboxEvent['status'], string>;
const EVENT_STATUS_COLOR = { pending: 'blue', done: 'green', failed: 'red' } as const satisfies Record<PaymentOutboxEvent['status'], string>;
const HEALTH_LABELS = [
  ['outboxPending', 'Outbox 积压'],
  ['outboxFailed', 'Outbox 死信'],
  ['webhookPending', 'Webhook 待投递'],
  ['webhookFailed24h', 'Webhook 24h失败'],
  ['sharingProcessing', '分账处理中'],
  ['transferProcessing', '转账处理中'],
  ['reconPendingDiff', '待处理对账差异'],
] as const;

interface SearchParams { keyword: string; status: string; type: string; }
const defaultSearch: SearchParams = { keyword: '', status: '', type: '' };

export default function PaymentEventsPage() {
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearch, listKey: paymentEventKeys.lists });
  const listQuery = usePaymentEventList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    type: submittedParams.type || undefined,
  });
  const data = listQuery.data ?? null;
  const healthQuery = usePaymentOpsHealth();
  const health = healthQuery.data ?? null;
  const redispatchMutation = useRedispatchPaymentEvent();
  const redispatchingId = redispatchMutation.isPending ? (redispatchMutation.variables ?? null) : null;

  function handleRedispatch(record: PaymentOutboxEvent) {
    redispatchMutation.mutate(record.id, { onSuccess: () => Toast.success('重投成功') });
  }

  const columns: ColumnProps<PaymentOutboxEvent>[] = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '事件类型', dataIndex: 'type', width: 180 },
    { title: '订单号', dataIndex: 'orderNo', width: 200 },
    { title: '次数', dataIndex: 'attempts', width: 80 },
    { title: '错误信息', dataIndex: 'lastError', width: 260, render: (v: string | null) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 240 }}>{v || '-'}</Typography.Text> },
    dateTimeColumn('创建时间', 'createdAt'),
    dateTimeColumn('处理时间', 'processedAt'),
    { title: '状态', dataIndex: 'status', width: 90, fixed: 'right', render: (v: PaymentOutboxEvent['status']) => <Tag color={EVENT_STATUS_COLOR[v]}>{EVENT_STATUS_LABELS[v]}</Tag> },
    createOperationColumn<PaymentOutboxEvent>({
      width: 90,
      actions: (r) => [
        ...(r.status !== 'done' && hasPermission('payment:ops:manage') ? [{
          key: 'redispatch',
          label: '重投',
          loading: redispatchingId === r.id,
          onClick: () => handleRedispatch(r),
        }] : []),
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput placeholder="订单号..." value={draftParams.keyword} onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} onSearch={handleSearch} width={200} />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={draftParams.status || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
    />
  );

  const renderTypeFilter = () => (
    <KeywordInput placeholder="事件类型..." value={draftParams.type} onChange={(v) => setDraftParams((p) => ({ ...p, type: v }))} onSearch={handleSearch} width={180} />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderHealthCards = () => (
    <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
      {HEALTH_LABELS.map(([key, label]) => {
        const value = health?.[key] ?? 0;
        const danger = (key === 'outboxFailed' || key === 'webhookFailed24h') && value > 0;
        return (
          <Col key={key} xs={12} sm={8} xl={3}>
            <div style={{ background: 'var(--semi-color-bg-1)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--semi-border-radius-medium)', padding: '12px 14px' }}>
              <Typography.Text type="tertiary" size="small">{label}</Typography.Text>
              <div style={{ marginTop: 6 }}>
                <Typography.Text strong type={danger ? 'danger' : undefined} style={{ fontSize: 22, lineHeight: '28px' }}>
                  {value}
                </Typography.Text>
              </div>
            </div>
          </Col>
        );
      })}
    </Row>
  );

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderKeywordSearch()}
            {renderStatusFilter()}
            {renderTypeFilter()}
            {renderSearchButton()}
            {renderResetButton()}
          </>
        )}
        mobilePrimary={(
          <>
            {renderKeywordSearch()}
            {renderSearchButton()}
          </>
        )}
        mobileFilters={(
          <>
            {renderStatusFilter()}
            {renderTypeFilter()}
          </>
        )}
        filterTitle="支付事件筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      {renderHealthCards()}

      <ConfigurableTable
        bordered columns={columns} dataSource={data?.list ?? []} loading={listQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
        onRefresh={() => void listQuery.refetch()} refreshLoading={listQuery.isFetching} pagination={buildPagination(data?.total ?? 0)}
      />
    </div>
  );
}
