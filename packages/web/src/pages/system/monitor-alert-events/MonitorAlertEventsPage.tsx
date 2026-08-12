import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Select, Tag } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { SearchToolbar } from '@/components/SearchToolbar';
import { dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { usePagination } from '@/hooks/usePagination';
import type { MonitorAlertEvent } from '@zenith/shared/platform';
import { monitorAlertKeys, useMonitorAlertEventList } from '@/hooks/queries/monitor-alerts';
import {
  MONITOR_ALERT_LEVEL_CONFIG as LEVEL_CONFIG,
  MONITOR_METRIC_GROUPED_OPTIONS as METRIC_GROUPS,
  MONITOR_METRIC_LABELS as METRIC_LABELS,
  formatMonitorMetricValue,
} from '../monitor-alerts/constants';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
const OP_SYMBOL: Record<string, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤' };

interface Filters { metric?: string; level?: string; status?: string; }

/** 指标筛选下拉：桌面与移动端共用，按业务域分组并支持搜索（指标已接近 30 个，平铺难以定位） */
function MetricFilterSelect({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <Select
      placeholder="全部指标"
      value={value}
      onChange={(v) => onChange(v as string | undefined)}
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

export default function MonitorAlertEventsPage() {
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<Filters>({});
  const [submittedFilters, setSubmittedFilters] = useState<Filters>({});
  const { page, pageSize, setPage, buildPagination } = usePagination();
  const listQuery = useMonitorAlertEventList({
    page,
    pageSize,
    metric: submittedFilters.metric || undefined,
    level: submittedFilters.level || undefined,
    status: submittedFilters.status || undefined,
  });
  const data = listQuery.data ?? null;

  function handleSearch() {
    setPage(1);
    setSubmittedFilters(draftFilters);
    void queryClient.invalidateQueries({ queryKey: monitorAlertKeys.eventLists });
  }

  function handleReset() {
    setDraftFilters({});
    setSubmittedFilters({});
    setPage(1);
    void queryClient.invalidateQueries({ queryKey: monitorAlertKeys.eventLists });
  }

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
    dateTimeColumn('恢复时间', 'resolvedAt'),
    {
      title: '状态', dataIndex: 'status', width: 90, fixed: 'right',
      render: (s: string) => s === 'firing' ? <Tag color="red" size="small">告警中</Tag> : <Tag color="green" size="small">已恢复</Tag>,
    },
  ];

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            <MetricFilterSelect value={draftFilters.metric} onChange={(v) => setDraftFilters((p) => ({ ...p, metric: v }))} />
            <Select
              placeholder="全部级别"
              value={draftFilters.level}
              onChange={(v) => setDraftFilters((p) => ({ ...p, level: v as string }))}
              showClear
              style={{ width: 120 }}
              optionList={Object.entries(LEVEL_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
            <Select
              placeholder="全部状态"
              value={draftFilters.status}
              onChange={(v) => setDraftFilters((p) => ({ ...p, status: v as string }))}
              showClear
              style={{ width: 120 }}
              optionList={[{ value: 'firing', label: '告警中' }, { value: 'resolved', label: '已恢复' }]}
            />
            <SearchButton onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        mobilePrimary={(
          <>
            <MetricFilterSelect value={draftFilters.metric} onChange={(v) => setDraftFilters((p) => ({ ...p, metric: v }))} />
            <SearchButton onClick={handleSearch} />
          </>
        )}
        mobileFilters={(
          <>
            <Select
              placeholder="全部级别"
              value={draftFilters.level}
              onChange={(v) => setDraftFilters((p) => ({ ...p, level: v as string }))}
              showClear
              style={{ width: 120 }}
              optionList={Object.entries(LEVEL_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
            <Select
              placeholder="全部状态"
              value={draftFilters.status}
              onChange={(v) => setDraftFilters((p) => ({ ...p, status: v as string }))}
              showClear
              style={{ width: 120 }}
              optionList={[{ value: 'firing', label: '告警中' }, { value: 'resolved', label: '已恢复' }]}
            />
          </>
        )}
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
