/**
 * App 推送发送记录页(只读日志:事件派发与测试发送的成败留痕)。
 */
import { Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import {
  PUSH_DELIVERY_STATUS_LABELS,
  PUSH_PROVIDER_LABELS,
  SEND_SOURCE_LABELS,
  type PushDeliveryStatus,
  type PushProvider,
  type PushSendLog,
  type SendSource,
  type SendStatus,
} from '@zenith/shared/messaging';
import ConfigurableTable from '@/components/ConfigurableTable';
import { SearchToolbar } from '@/components/SearchToolbar';
import { DateRangeFilter, KeywordInput, StatusSelect } from '@/components/search-filters';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { EMPTY_PLACEHOLDER, createdAtColumn, dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { formatDateTimeRangeForApi } from '@/utils/date';
import { useListSearch } from '@/hooks/useListSearch';
import { pushSendLogKeys, usePushSendLogList } from '@/hooks/queries/push';
import { SEND_LOG_STATUS_OPTIONS } from '../send-log-constants';

const { Text } = Typography;

const STATUS_COLORS: Record<SendStatus, 'orange' | 'green' | 'red'> = {
  pending: 'orange',
  success: 'green',
  failed: 'red',
};

const DELIVERY_COLORS: Record<PushDeliveryStatus, 'green' | 'blue'> = {
  delivered: 'green',
  clicked: 'blue',
};

interface SearchParams {
  keyword: string;
  status: string;
  timeRange: [Date, Date] | null;
}

const defaultSearchParams: SearchParams = { keyword: '', status: '', timeRange: null };

export default function PushSendLogsPage() {
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: pushSendLogKeys.lists });

  const listQuery = usePushSendLogList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
    ...formatDateTimeRangeForApi(submittedParams.timeRange),
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const columns: ColumnProps<PushSendLog>[] = [
    { title: '应用', dataIndex: 'appName', width: 120, render: renderEllipsis },
    { title: '标题', dataIndex: 'title', width: 200, render: renderEllipsis },
    { title: '内容', dataIndex: 'content', width: 260, render: renderEllipsis },
    {
      title: '事件', dataIndex: 'eventKey', width: 180,
      render: (v: string | null) => (v ? <Text code>{v}</Text> : EMPTY_PLACEHOLDER),
    },
    {
      title: '收件人', dataIndex: 'subjectName', width: 120,
      render: (_: unknown, record: PushSendLog) => record.subjectName
        ?? (record.subjectType ? `${record.subjectType}#${record.subjectId}` : EMPTY_PLACEHOLDER),
    },
    { title: '设备数', dataIndex: 'deviceCount', width: 80 },
    {
      title: '供应商', dataIndex: 'provider', width: 100,
      render: (v: PushProvider) => PUSH_PROVIDER_LABELS[v],
    },
    {
      title: '来源', dataIndex: 'source', width: 80,
      render: (v: SendSource) => SEND_SOURCE_LABELS[v],
    },
    {
      title: '送达状态', dataIndex: 'deliveryStatus', width: 100,
      render: (v: PushDeliveryStatus | null, record: PushSendLog) => {
        if (!v) return EMPTY_PLACEHOLDER;
        const detail = [
          record.deliveredAt ? `送达 ${record.deliveredAt}` : null,
          record.clickedAt ? `点击 ${record.clickedAt}` : null,
        ].filter(Boolean).join(' / ');
        return (
          <Tooltip content={detail || undefined}>
            <Tag color={DELIVERY_COLORS[v]} size="small">{PUSH_DELIVERY_STATUS_LABELS[v]}</Tag>
          </Tooltip>
        );
      },
    },
    { title: '错误信息', dataIndex: 'errorMsg', width: 220, render: renderEllipsis },
    dateTimeColumn('发送时间', 'sentAt'),
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (v: SendStatus) => <Tag color={STATUS_COLORS[v]} size="small">{SEND_LOG_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v}</Tag>,
    },
  ];

  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索标题 / 内容 / 事件..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={SEND_LOG_STATUS_OPTIONS}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderTimeRangeFilter = () => (
    <DateRangeFilter
      value={draftParams.timeRange}
      onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v }))}
    />
  );

  return (
    <div className="page-container">
      <SearchToolbar
        primary={<>
          {renderKeywordSearch()}
          {renderStatusFilter()}
          {renderTimeRangeFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        mobilePrimary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
        </>}
        mobileFilters={<>
          {renderStatusFilter()}
          {renderTimeRangeFilter()}
        </>}
        filterTitle="筛选条件"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无推送记录"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />
    </div>
  );
}
