import { PAYMENT_CHANNEL_TAG_COLOR } from '@/utils/payment';
import { Select, Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { SearchToolbar } from '@/components/SearchToolbar';
import { formatDateTimeRangeForApi } from '@/utils/date';
import { PAYMENT_CHANNEL_LABELS, PAYMENT_CHANNEL_OPTIONS } from '@zenith/shared/payment';
import type { PaymentChannel, PaymentNotifyLog } from '@zenith/shared/payment';
import { paymentLogKeys, usePaymentLogList } from '@/hooks/queries/payment-logs';
import { useListSearch } from '@/hooks/useListSearch';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { DateRangeFilter, KeywordInput } from '@/components/search-filters';
import { compactQuery } from '@/lib/query';
import { copyableNoColumn, dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { JsonBlock } from '@/components/JsonBlock';

interface SearchParams { keyword: string; channel: string; scene: string; signatureValid: string; timeRange: [Date, Date] | null; }
const defaultSearch: SearchParams = { keyword: '', channel: '', scene: '', signatureValid: '', timeRange: null };

function formatRaw(raw: string | null | undefined): string {
  if (!raw) return '';
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

export default function PaymentLogsPage() {  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearch, listKey: paymentLogKeys.lists });

  function buildQuery(active: SearchParams): Record<string, string> {
    return compactQuery({
      keyword: active.keyword,
      channel: active.channel,
      scene: active.scene,
      signatureValid: active.signatureValid,
      ...formatDateTimeRangeForApi(active.timeRange),
    });
  }

  const listQuery = usePaymentLogList({ page, pageSize, ...buildQuery(submittedParams) });
  const data = listQuery.data ?? null;

  const columns: ColumnProps<PaymentNotifyLog>[] = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '渠道', dataIndex: 'channel', width: 100, render: (v: PaymentChannel) => <Tag color={PAYMENT_CHANNEL_TAG_COLOR[v]}>{PAYMENT_CHANNEL_LABELS[v]}</Tag> },
    { title: '场景', dataIndex: 'scene', width: 100, render: (v: string) => (v === 'refund' ? '退款回调' : '支付回调') },
    copyableNoColumn('订单号', 'orderNo'),
    { title: '验签', dataIndex: 'signatureValid', width: 90, render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '通过' : '失败'}</Tag> },
    { title: '结果', dataIndex: 'result', width: 120, render: (v: string | null) => v || '-' },
    { title: '说明', dataIndex: 'message', width: 220, render: (v: string | null) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 200 }}>{v || '-'}</Typography.Text> },
    { title: 'IP', dataIndex: 'ip', width: 150, render: renderEllipsis },
    dateTimeColumn('时间', 'createdAt'),
  ];

  /** 行内展开：请求头与原始 Body（无内容的行不可展开） */
  const renderExpanded = (r?: PaymentNotifyLog) => (r ? (
    // flex: 1 + minWidth: 0：Semi 展开行容器是 flex row，不声明会被收缩成内容最小宽
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0', flex: 1, minWidth: 0 }}>
      {r.headers && (
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>请求头</Typography.Text>
          <JsonBlock value={formatRaw(r.headers)} />
        </div>
      )}
      <div>
        <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>原始 Body</Typography.Text>
        <JsonBlock value={formatRaw(r.rawBody) || '（无）'} />
      </div>
    </div>
  ) : null);

  const renderKeywordSearch = () => (
    <KeywordInput placeholder="订单号..." value={draftParams.keyword} onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))} onSearch={handleSearch} width={200} />
  );

  const renderChannelFilter = () => (
    <Select
      placeholder="全部渠道"
      value={draftParams.channel || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, channel: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={PAYMENT_CHANNEL_OPTIONS}
    />
  );

  const renderSceneFilter = () => (
    <Select
      placeholder="全部场景"
      value={draftParams.scene || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, scene: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={[{ value: 'payment', label: '支付回调' }, { value: 'refund', label: '退款回调' }]}
    />
  );

  const renderSignatureFilter = () => (
    <Select
      placeholder="验签结果"
      value={draftParams.signatureValid || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, signatureValid: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={[{ value: 'true', label: '验签通过' }, { value: 'false', label: '验签失败' }]}
    />
  );

  const renderTimeRangeFilter = () => (
    <DateRangeFilter value={draftParams.timeRange ?? undefined} onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v ? (v as [Date, Date]) : null }))} width={330} />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderKeywordSearch()}
            {renderChannelFilter()}
            {renderSceneFilter()}
            {renderSignatureFilter()}
            {renderTimeRangeFilter()}
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
            {renderChannelFilter()}
            {renderSceneFilter()}
            {renderSignatureFilter()}
            {renderTimeRangeFilter()}
          </>
        )}
        filterTitle="支付回调日志筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered columns={columns} dataSource={data?.list ?? []} loading={listQuery.isFetching} rowKey="id" size="small" empty="暂无数据"
        onRefresh={() => void listQuery.refetch()} refreshLoading={listQuery.isFetching} pagination={buildPagination(data?.total ?? 0)}
        expandedRowRender={renderExpanded}
        hideExpandedColumn={false}
        rowExpandable={(r) => !!(r && (r.rawBody || r.headers))}
        expandRowByClick
      />
    </div>
  );
}
