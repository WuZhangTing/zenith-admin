import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select, Tag, Tooltip } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import ExportButton from '@/components/ExportButton';
import { SearchToolbar } from '@/components/SearchToolbar';
import { DateRangeFilter, KeywordInput } from '@/components/search-filters';
import { dateTimeColumn, renderEllipsis, EMPTY_PLACEHOLDER } from '@/utils/table-columns';
import { formatDateTimeRangeForApi } from '@/utils/date';
import { useListSearch } from '@/hooks/useListSearch';
import { usePermission } from '@/hooks/usePermission';
import type { MonitorAlertEvent } from '@zenith/shared/platform';
import {
  MONITOR_ALERT_EVENT_STATUS_OPTIONS,
  MONITOR_ALERT_LEVEL_OPTIONS,
  MONITOR_ALERT_NOTIFY_STATUS_OPTIONS,
} from '@zenith/shared/platform';
import { NOTIFY_CHANNEL_LABELS } from '@zenith/shared/messaging';
import { monitorAlertKeys, useMonitorAlertEventList } from '@/hooks/queries/monitor-alerts';
import {
  MONITOR_ALERT_LEVEL_CONFIG as LEVEL_CONFIG,
  MONITOR_ALERT_NOTIFY_STATUS_CONFIG as NOTIFY_CONFIG,
  MONITOR_METRIC_GROUPED_OPTIONS as METRIC_GROUPS,
  MONITOR_METRIC_LABELS as METRIC_LABELS,
  formatMonitorMetricValue,
} from '../rules/constants';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';

const OP_SYMBOL: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤' };
const CHANNEL_LABELS: Record<string, string> = NOTIFY_CHANNEL_LABELS;

interface SearchParams {
  keyword: string;
  metric: string;
  level: string;
  status: string;
  notifyStatus: string;
  timeRange: [Date, Date] | null;
}

const defaultSearchParams: SearchParams = {
  keyword: '', metric: '', level: '', status: '', notifyStatus: '', timeRange: null,
};

/** 指标筛选下拉：桌面与移动端共用，按业务域分组并支持搜索（指标已接近 30 个，平铺难以定位） */
function MetricFilterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select
      placeholder="全部指标"
      value={value || undefined}
      onChange={(v) => onChange((v as string) ?? '')}
      showClear
      filter
      style={{ width: 170 }}
    >
      {METRIC_GROUPS.map((group) => (
        <Select.OptGroup key={group.group} label={group.label}>
          {group.children.map((option) => (
            <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>
          ))}
        </Select.OptGroup>
      ))}
    </Select>
  );
}

export default function AlertEventsPage() {
  const { hasPermission } = usePermission();
  // 从告警规则页「查看事件」跳转而来时按规则过滤；URL 是这个联查的唯一来源，刷新后依然生效
  const [urlParams, setUrlParams] = useSearchParams();
  const ruleId = Number(urlParams.get('ruleId')) || undefined;

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: monitorAlertKeys.eventLists });

  const queryParams = useMemo(() => ({
    keyword: submittedParams.keyword || undefined,
    metric: submittedParams.metric || undefined,
    level: submittedParams.level || undefined,
    status: submittedParams.status || undefined,
    notifyStatus: submittedParams.notifyStatus || undefined,
    ruleId,
    ...formatDateTimeRangeForApi(submittedParams.timeRange),
  }), [submittedParams, ruleId]);

  const listQuery = useMonitorAlertEventList({ page, pageSize, ...queryParams });
  const data = listQuery.data ?? null;

  const columns: ColumnProps<MonitorAlertEvent>[] = [
    dateTimeColumn('触发时间', 'triggeredAt', { fixed: 'left' }),
    { title: '规则', dataIndex: 'ruleName', width: 160, render: renderEllipsis },
    {
      title: '触发条件', dataIndex: 'metric', width: 210,
      render: (_: unknown, r: MonitorAlertEvent) => (
        <span>
          <Tag size="small" type="ghost">{METRIC_LABELS[r.metric] ?? r.metric}</Tag>
          {' '}{OP_SYMBOL[r.operator] ?? r.operator} {formatMonitorMetricValue(r.metric, r.threshold)}
        </span>
      ),
    },
    { title: '实际值', dataIndex: 'value', width: 110, render: (v: number, r: MonitorAlertEvent) => <b>{formatMonitorMetricValue(r.metric, v)}</b> },
    { title: '级别', dataIndex: 'level', width: 80, render: (v: string) => <Tag color={LEVEL_CONFIG[v]?.color ?? 'grey'} size="small">{LEVEL_CONFIG[v]?.label ?? v}</Tag> },
    { title: '描述', dataIndex: 'message', width: 280, render: renderEllipsis },
    {
      title: '通知状态', dataIndex: 'notifyStatus', width: 120,
      render: (_: unknown, r: MonitorAlertEvent) => {
        const config = NOTIFY_CONFIG[r.notifyStatus];
        const channels = r.notifyChannels.map((c) => CHANNEL_LABELS[c] ?? c).join('、');
        const tip = r.notifyError
          ?? (r.notifyStatus === 'skipped' ? '规则未配置任何通知渠道' : channels ? `已尝试渠道：${channels}` : undefined);
        const tag = <Tag color={config?.color ?? 'grey'} size="small">{config?.label ?? r.notifyStatus}</Tag>;
        return tip ? <Tooltip content={tip}>{tag}</Tooltip> : tag;
      },
    },
    dateTimeColumn('通知时间', 'notifiedAt', { empty: EMPTY_PLACEHOLDER }),
    dateTimeColumn('恢复时间', 'resolvedAt'),
    {
      title: '状态', dataIndex: 'status', width: 90, fixed: 'right',
      render: (s: string) => s === 'firing' ? <Tag color="red" size="small">告警中</Tag> : <Tag color="green" size="small">已恢复</Tag>,
    },
  ];

  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索规则名称或描述..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderMetricFilter = () => (
    <MetricFilterSelect
      value={draftParams.metric}
      onChange={(v) => setDraftParams((p) => ({ ...p, metric: v }))}
    />
  );

  const renderLevelFilter = () => (
    <Select
      placeholder="全部级别"
      value={draftParams.level || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, level: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={MONITOR_ALERT_LEVEL_OPTIONS}
    />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={draftParams.status || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: (v as string) ?? '' }))}
      showClear
      style={{ width: 120 }}
      optionList={MONITOR_ALERT_EVENT_STATUS_OPTIONS}
    />
  );

  const renderNotifyStatusFilter = () => (
    <Select
      placeholder="全部通知状态"
      value={draftParams.notifyStatus || undefined}
      onChange={(v) => setDraftParams((p) => ({ ...p, notifyStatus: (v as string) ?? '' }))}
      showClear
      style={{ width: 140 }}
      optionList={MONITOR_ALERT_NOTIFY_STATUS_OPTIONS}
    />
  );

  const renderTimeRangeFilter = () => (
    <DateRangeFilter
      value={draftParams.timeRange}
      onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v }))}
    />
  );

  const renderRuleFilterTag = () => ruleId ? (
    <Tag
      closable
      color="blue"
      onClose={() => setUrlParams({}, { replace: true })}
    >
      仅看规则 #{ruleId}
    </Tag>
  ) : null;

  const renderExportButton = (variant?: 'flat') => hasPermission('alert:event:export')
    ? <ExportButton entity="alert.monitor-alert-events" query={queryParams} variant={variant} />
    : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderRuleFilterTag()}
            {renderKeywordSearch()}
            {renderMetricFilter()}
            {renderLevelFilter()}
            {renderStatusFilter()}
            {renderNotifyStatusFilter()}
            {renderTimeRangeFilter()}
            <SearchButton onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={renderExportButton()}
        mobilePrimary={(
          <>
            {renderRuleFilterTag()}
            {renderKeywordSearch()}
            <SearchButton onClick={handleSearch} />
          </>
        )}
        mobileFilters={(
          <>
            {renderMetricFilter()}
            {renderLevelFilter()}
            {renderStatusFilter()}
            {renderNotifyStatusFilter()}
            {renderTimeRangeFilter()}
          </>
        )}
        mobileActions={renderExportButton('flat')}
        filterTitle="告警事件筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={data?.list ?? []}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无告警记录"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(data?.total ?? 0)}
      />
    </div>
  );
}
