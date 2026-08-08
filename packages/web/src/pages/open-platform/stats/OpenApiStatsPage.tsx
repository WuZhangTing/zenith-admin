import { useMemo } from 'react';
import { DatePicker, InputNumber, Select, Typography, Tag, Space, Card } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import dayjs from 'dayjs';
import type { OpenApiCallLog } from '@zenith/shared/open-platform';
import { OPEN_APP_ENVIRONMENT_LABELS, OPEN_APP_ENVIRONMENTS } from '@zenith/shared/open-platform';
import { SearchToolbar } from '@/components/SearchToolbar';
import ConfigurableTable from '@/components/ConfigurableTable';
import { ExportButton } from '@/components/ExportButton';
import { useListSearch } from '@/hooks/useListSearch';
import { AreaChart, BarChart, chartOptions, makeAreaSpec, makeBarSpec, useChartPalette, EmptyChart, StatCard, StatGrid } from '@/components/charts';
import {
  openPlatformKeys,
  useOpenApiCallLogs,
  useOpenApiStatsByApp,
  useOpenApiStatsByEndpoint,
  useOpenApiStatsOverview,
  useOpenApiStatsTrend,
  useOpenAppOptions,
} from '@/hooks/queries/open-platform';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';

const { Text, Title } = Typography;

export default function OpenApiStatsPage() {
  const palette = useChartPalette();
  interface SearchParams {
    range: [Date, Date];
    granularity: 'hour' | 'day';
    keyword: string;
    clientId?: string;
    method?: string;
    success?: boolean;
    statusCode?: number;
    environment?: OpenApiCallLog['environment'];
  }
  const createDefaultParams = (): SearchParams => ({
    range: [dayjs().subtract(6, 'day').toDate(), new Date()],
    granularity: 'day',
    keyword: '',
  });
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch: handleApply, handleReset,
  } = useListSearch<SearchParams>({ defaults: createDefaultParams, listKey: openPlatformKeys.stats.all });
  const appOptions = useOpenAppOptions().data ?? [];

  const rangeParams = useMemo(() => ({
    startTime: dayjs(submittedParams.range[0]).startOf('day').format('YYYY-MM-DD HH:mm:ss'),
    endTime: dayjs(submittedParams.range[1]).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
    clientId: submittedParams.clientId,
    environment: submittedParams.environment,
  }), [submittedParams]);
  const overviewQuery = useOpenApiStatsOverview(rangeParams);
  const trendQuery = useOpenApiStatsTrend({ ...rangeParams, granularity: submittedParams.granularity });
  const byAppQuery = useOpenApiStatsByApp(rangeParams);
  const byEndpointQuery = useOpenApiStatsByEndpoint(rangeParams);
  const logParams = {
    ...rangeParams,
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    method: submittedParams.method,
    success: submittedParams.success,
    statusCode: submittedParams.statusCode,
  };
  const logsQuery = useOpenApiCallLogs(logParams);
  const overview = overviewQuery.data ?? null;
  const trend = useMemo(() => trendQuery.data ?? [], [trendQuery.data]);
  const byApp = useMemo(() => byAppQuery.data ?? [], [byAppQuery.data]);
  const byEndpoint = useMemo(() => byEndpointQuery.data ?? [], [byEndpointQuery.data]);
  const logs = logsQuery.data ?? null;
  const statLoading = overviewQuery.isFetching || trendQuery.isFetching || byAppQuery.isFetching || byEndpointQuery.isFetching;

  const trendSpec = useMemo(() => makeAreaSpec({
    data: trend,
    xField: 'time',
    series: [
      { field: 'success', name: '成功', color: '#16a34a' },
      { field: 'failed', name: '失败', color: '#dc2626' },
    ],
    palette,
    stack: true,
  }), [trend, palette]);

  const appSpec = useMemo(() => makeBarSpec({
    data: byApp,
    xField: 'label',
    series: [{ field: 'total', name: '调用次数', color: '#3b82f6' }],
    palette,
    horizontal: true,
    showLabel: true,
    categoryAxisWidth: 110,
  }), [byApp, palette]);

  const endpointSpec = useMemo(() => makeBarSpec({
    data: byEndpoint,
    xField: 'label',
    series: [{ field: 'total', name: '调用次数', color: '#8b5cf6' }],
    palette,
    horizontal: true,
    showLabel: true,
    categoryAxisWidth: 160,
  }), [byEndpoint, palette]);

  const logColumns: ColumnProps<OpenApiCallLog>[] = [
    { title: '时间', dataIndex: 'createdAt', width: 160 },
    {
      title: '应用',
      dataIndex: 'appName',
      width: 180,
      render: (v: string | null, r: OpenApiCallLog) => (
        <div>
          <div>{v || <Text type="tertiary">未知</Text>}</div>
          <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ maxWidth: 160 }}>{r.clientId}</Text>
        </div>
      ),
    },
    {
      title: '请求',
      dataIndex: 'path',
      render: (v: string, r: OpenApiCallLog) => (
        <Space spacing={6}>
          <Tag size="small" color="grey">{r.method}</Tag>
          <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 280 }}>{v}</Text>
        </Space>
      ),
    },
    { title: 'Scope', dataIndex: 'scope', width: 120, render: (v: string | null) => v ? <Tag size="small" color="blue">{v}</Tag> : <Text type="tertiary">—</Text> },
    { title: '耗时', dataIndex: 'durationMs', width: 90, render: (v: number) => `${v} ms` },
    { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string | null) => v || '—' },
    {
      title: '环境',
      dataIndex: 'environment',
      width: 90,
      render: (value: OpenApiCallLog['environment']) => (
        <Tag size="small" color={value === 'sandbox' ? 'orange' : 'blue'}>{OPEN_APP_ENVIRONMENT_LABELS[value]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'statusCode',
      width: 90,
      fixed: 'right' as const,
      render: (v: number, r: OpenApiCallLog) => <Tag size="small" color={r.success ? 'green' : 'red'}>{v}</Tag>,
    },
  ];

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            <DatePicker
              type="dateRange"
              value={draftParams.range}
              onChange={(v) => {
                if (Array.isArray(v) && v.length === 2) {
                  setDraftParams({ ...draftParams, range: [v[0] as Date, v[1] as Date] });
                }
              }}
              density="compact"
              style={{ width: 256 }}
            />
            <Select
              value={draftParams.granularity}
              onChange={(v) => setDraftParams({ ...draftParams, granularity: v as 'hour' | 'day' })}
              optionList={[{ value: 'day', label: '按天' }, { value: 'hour', label: '按小时' }]}
              style={{ width: 110 }}
            />
            <SearchButton onClick={handleApply} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        filters={(
          <>
            <KeywordInput placeholder="路径 / 应用名称" value={draftParams.keyword} onChange={(keyword) => setDraftParams({ ...draftParams, keyword })} onSearch={handleApply} width={190} />
            <Select
              placeholder="应用"
              value={draftParams.clientId}
              onChange={(clientId) => setDraftParams({ ...draftParams, clientId: clientId as string })}
              optionList={appOptions.map((app) => ({ value: app.clientId, label: app.name }))}
              showClear
              filter
              style={{ width: 170 }}
            />
            <Select
              placeholder="环境"
              value={draftParams.environment}
              onChange={(environment) => setDraftParams({ ...draftParams, environment: environment as OpenApiCallLog['environment'] })}
              optionList={OPEN_APP_ENVIRONMENTS.map((value) => ({ value, label: OPEN_APP_ENVIRONMENT_LABELS[value] }))}
              showClear
              style={{ width: 110 }}
            />
            <Select
              placeholder="请求方法"
              value={draftParams.method}
              onChange={(method) => setDraftParams({ ...draftParams, method: method as string })}
              optionList={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value }))}
              showClear
              style={{ width: 120 }}
            />
            <Select
              placeholder="调用结果"
              value={draftParams.success === undefined ? undefined : String(draftParams.success)}
              onChange={(success) => setDraftParams({
                ...draftParams,
                success: success === undefined ? undefined : success === 'true',
              })}
              optionList={[{ value: 'true', label: '成功' }, { value: 'false', label: '失败' }]}
              showClear
              style={{ width: 110 }}
            />
            <InputNumber
              placeholder="状态码"
              value={draftParams.statusCode}
              onChange={(statusCode) => setDraftParams({ ...draftParams, statusCode: typeof statusCode === 'number' ? statusCode : undefined })}
              min={100}
              max={599}
              style={{ width: 110 }}
            />
          </>
        )}
        actions={<ExportButton entity="open-platform.call-logs" query={logParams} executionMode="auto" />}
        mobilePrimary={(
          <>
            <KeywordInput placeholder="搜索调用日志" value={draftParams.keyword} onChange={(keyword) => setDraftParams({ ...draftParams, keyword })} onSearch={handleApply} width={190} />
            <SearchButton onClick={handleApply} />
          </>
        )}
        mobileFilters={(
          <>
            <DatePicker
              type="dateRange"
              value={draftParams.range}
              onChange={(v) => {
                if (Array.isArray(v) && v.length === 2) {
                  setDraftParams({ ...draftParams, range: [v[0] as Date, v[1] as Date] });
                }
              }}
              style={{ width: '100%' }}
            />
            <Select
              placeholder="应用"
              value={draftParams.clientId}
              onChange={(clientId) => setDraftParams({ ...draftParams, clientId: clientId as string })}
              optionList={appOptions.map((app) => ({ value: app.clientId, label: app.name }))}
              showClear
              filter
              style={{ width: '100%' }}
            />
            <Select
              placeholder="环境"
              value={draftParams.environment}
              onChange={(environment) => setDraftParams({ ...draftParams, environment: environment as OpenApiCallLog['environment'] })}
              optionList={OPEN_APP_ENVIRONMENTS.map((value) => ({ value, label: OPEN_APP_ENVIRONMENT_LABELS[value] }))}
              showClear
              style={{ width: '100%' }}
            />
          </>
        )}
        mobileActions={<ExportButton entity="open-platform.call-logs" query={logParams} executionMode="auto" variant="flat" />}
        actionTitle="统计操作"
      />

      <StatGrid minItemWidth={150} style={{ marginBottom: 16 }}>
        <StatCard title="调用总数" value={(overview?.totalCalls ?? 0).toLocaleString()} sub={`今日 ${overview?.todayCalls ?? 0}`} />
        <StatCard title="成功率" value={`${overview?.successRate ?? 0}%`} accent="#16a34a" sub={`成功 ${overview?.successCalls ?? 0}`} />
        <StatCard title="失败数" value={(overview?.failedCalls ?? 0).toLocaleString()} accent="#dc2626" />
        <StatCard title="平均耗时" value={`${overview?.avgDurationMs ?? 0} ms`} />
        <StatCard
          title="P95 耗时"
          value={`${overview?.p95DurationMs ?? 0} ms`}
          sub={overview?.percentilesPartial ? `仅基于近 ${overview.percentileRetentionDays} 天原始日志` : '95% 请求低于该值'}
        />
        <StatCard
          title="P99 耗时"
          value={`${overview?.p99DurationMs ?? 0} ms`}
          sub={overview?.percentilesPartial ? `仅基于近 ${overview.percentileRetentionDays} 天原始日志` : '99% 请求低于该值'}
        />
        <StatCard title="活跃应用" value={overview?.activeApps ?? 0} />
      </StatGrid>

      <Card style={{ marginBottom: 16 }} title={<Title heading={6} style={{ margin: 0 }}>调用趋势</Title>} loading={statLoading}>
        {trend.length ? <AreaChart {...trendSpec} options={chartOptions} height={280} /> : <EmptyChart height={280} />}
      </Card>

      <div className="chart-grid" style={{ marginBottom: 16 }}>
        <Card title={<Title heading={6} style={{ margin: 0 }}>应用调用 Top</Title>} loading={statLoading}>
          {byApp.length ? <BarChart {...appSpec} options={chartOptions} height={300} /> : <EmptyChart height={300} />}
        </Card>
        <Card title={<Title heading={6} style={{ margin: 0 }}>端点调用 Top</Title>} loading={statLoading}>
          {byEndpoint.length ? <BarChart {...endpointSpec} options={chartOptions} height={300} /> : <EmptyChart height={300} />}
        </Card>
      </div>

      <Card title={<Title heading={6} style={{ margin: 0 }}>调用日志</Title>}>
        <ConfigurableTable
          bordered
          columns={logColumns}
          dataSource={logs?.list ?? []}
          loading={logsQuery.isFetching}
          onRefresh={() => void logsQuery.refetch()}
          refreshLoading={logsQuery.isFetching}
          rowKey="id"
          size="small"
          empty="暂无调用记录"
          pagination={buildPagination(logs?.total ?? 0)}
        />
      </Card>
    </div>
  );
}
