import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CSSProperties, ReactNode } from 'react';
import { Avatar, Button, Card, DatePicker, Dropdown, Empty, Input, InputNumber, Modal, Select, SideSheet, Skeleton, Space, Spin, Switch, TabPane, Tabs, Tag, Timeline, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Activity, BarChart3, Bookmark, Clock, Eye, Flame, Plus, RefreshCcw, Search, Target, Trash2, TrendingUp, Users, Zap } from 'lucide-react';
import { DataBar } from '@/components/data-viz/DataBar';
import {
  AreaChart,
  BarChart,
  LineChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
  chartOptions,
  makeAreaSpec,
  makeBarSpec,
  makeLineSpec,
  makeSankeySpec,
  makeScatterSpec,
  makeTreemapSpec,
  datumNumber,
  datumText,
  datumBoolean,
  useChartPalette,
  StatCard,
  StatGrid,
  type ChartDatum,
  type TreemapNode,
} from '@/components/charts';
import { ConfigurableTable } from '@/components/ConfigurableTable';
import { SearchToolbar } from '@/components/SearchToolbar';
import { formatDateTime, formatDateForApi } from '@/utils/date';
import { dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { useWebSocket } from '@/hooks/useWebSocket';
import { usePagination } from '@/hooks/usePagination';
import { useUrlTabState } from '@/hooks/useUrlTabState';
import {
  analyticsKeys,
  useAnalyzeFunnel,
  useAnalyticsFeatureStats,
  useAnalyticsHeatmap,
  useAnalyticsHeatmapPages,
  useAnalyticsOverview,
  useAnalyticsPageStats,
  useAnalyticsPath,
  useAnalyticsRealtime,
  useAnalyticsRetention,
  useAnalyticsSessions,
  useAnalyticsTrends,
  useAnalyticsUserStats,
  useAnalyticsUserTimeline,
  useSessionTimeline,
  useSavedFunnelReports,
  useSaveFunnelReport,
  useDeleteFunnelReport,
} from '@/hooks/queries/analytics';
import type { AnalyticsComparison, AnalyticsRetentionMode, AnalyticsRetentionPeriodType, AnalyticsSavedReport, AnalyticsSegmentPropertyFilter, FeatureStats, HeatmapData, HeatmapElementItem, HeatmapPageListItem, HeatmapRageClickItem, PageStats, PathLink } from '@zenith/shared/analytics';
import type { UserStats } from '@zenith/shared/identity';
import type { SessionListItem } from '@zenith/shared/platform';
import { ANALYTICS_DEVICE_TYPE_OPTIONS, ANALYTICS_EVENT_SOURCE_OPTIONS, ANALYTICS_PATH_EXIT_PAGE, ANALYTICS_RETENTION_MODE_OPTIONS, ANALYTICS_RETENTION_PERIOD_LIMITS, ANALYTICS_RETENTION_PERIOD_TYPE_OPTIONS, ANALYTICS_RETENTION_PERIOD_UNIT_LABELS, ANALYTICS_SEGMENT_COMPARE_OP_OPTIONS, USER_BEHAVIOR_EVENT_TYPE_LABELS } from '@zenith/shared/analytics';
import AnalyticsEventQueryTab from './AnalyticsEventQueryTab';
import AnalyticsExperimentsTab from './AnalyticsExperimentsTab';
import AnalyticsAcquisitionTab from './AnalyticsAcquisitionTab';
import { ComparisonPicker, DrillUsersSheet, isComparisonReady, useDrillSheet } from './AnalyticsComparison';
import { BEHAVIOR_DAYS_OPTIONS, BehaviorDaysProvider, useBehaviorDays } from './behavior-days-context';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { confirmDelete } from '@/utils/confirm';

function msToReadable(ms: number | null): string {
  if (ms == null) return '–';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
const DAYS_OPTIONS = BEHAVIOR_DAYS_OPTIONS;

/** 无语义元素（elementLabel 缺失或就是裸标签名）的展示兜底：「未命名 button」比裸 "button" 更明确 */
const GENERIC_ELEMENT_LABELS = new Set(['button', 'a', 'div', 'span', 'input', 'svg', 'img', 'li', 'td', 'p', 'i', 'label']);
function elementDisplayName(elementLabel: string | null | undefined, elementKey: string): string {
  const label = elementLabel?.trim();
  if (label && !GENERIC_ELEMENT_LABELS.has(label.toLowerCase())) return label;
  const tag = label || elementKey.split(':')[0] || '元素';
  return `未命名 ${tag}`;
}

const RETENTION_DAYS_OPTIONS: Record<AnalyticsRetentionPeriodType, Array<{ label: string; value: number }>> = {
  day: [
    { label: '近 7 天', value: 7 },
    { label: '近 14 天', value: 14 },
    { label: '近 30 天', value: 30 },
    { label: '近 60 天', value: 60 },
    { label: '近 90 天', value: 90 },
  ],
  week: [
    { label: '近 8 周', value: 56 },
    { label: '近 12 周', value: 84 },
    { label: '近 26 周', value: 182 },
    { label: '近 52 周', value: 365 },
  ],
  month: [
    { label: '近 6 个月', value: 183 },
    { label: '近 12 个月', value: 365 },
    { label: '近 24 个月', value: 730 },
  ],
};

/** 周期列数候选：上限随粒度收敛，避免月留存出现 30 列空白 */
function retentionPeriodOptions(periodType: AnalyticsRetentionPeriodType): Array<{ label: string; value: number }> {
  const unit = ANALYTICS_RETENTION_PERIOD_UNIT_LABELS[periodType];
  const { maxPeriods } = ANALYTICS_RETENTION_PERIOD_LIMITS[periodType];
  return [4, 6, 8, 12, 16, 24, 30]
    .filter((n) => n <= maxPeriods)
    .map((n) => ({ label: `${n} 个${unit}周期`, value: n }));
}

const DEVICE_OPTIONS = [
  { label: '全部设备', value: '' },
  ...ANALYTICS_DEVICE_TYPE_OPTIONS,
];

const HEATMAP_SOURCE_OPTIONS = [
  { label: '全部来源', value: '' },
  ...ANALYTICS_EVENT_SOURCE_OPTIONS,
];

const EMPTY_HEATMAP_PAGES: HeatmapPageListItem[] = [];

/** 图表只做 TOP N 概览：treemap 叶子过多、饼图切片过多都读不出信息，因此与分页表格分开取数 */
const CHART_TOP_N = 20;

const ACCENT_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#64748b'];

const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };

function numberText(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function percentText(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '–';
  return `${value.toFixed(digits)}%`;
}

function DeltaText({ value, suffix = '%' }: Readonly<{ value: number; suffix?: string }>) {
  if (value === 0) return <span style={{ color: 'var(--semi-color-text-2)' }}>持平</span>;
  const positive = value > 0;
  return (
    <span style={{ color: positive ? 'var(--semi-color-success)' : 'var(--semi-color-danger)', fontWeight: 600 }}>
      {positive ? '▲' : '▼'} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function SectionHeader({
  title,
  description,
  extra,
}: Readonly<{ title: string; description?: string; extra?: ReactNode }>) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <Typography.Title heading={5} style={{ margin: 0 }}>{title}</Typography.Title>
        {description ? <Typography.Text type="tertiary">{description}</Typography.Text> : null}
      </div>
      {extra}
    </div>
  );
}

function emptyOrSpin(loading: boolean, description = '暂无数据') {
  if (loading) return <div style={{ height: 260, display: 'grid', placeItems: 'center' }}><Spin /></div>;
  return <Empty description={description} />;
}

type ChartRow = Record<string, number | string>;

function chartColor(index: number, primary: string): string {
  return index === 0 ? primary : ACCENT_COLORS[(index - 1) % ACCENT_COLORS.length];
}

function OverviewTab() {
  const palette = useChartPalette();
  const [days, setDays] = useBehaviorDays();
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);
  const [compare, setCompare] = useState(false);
  const range = useMemo(
    () => (customRange ? { days, startDate: customRange[0], endDate: customRange[1] } : { days }),
    [customRange, days],
  );
  const overviewQuery = useAnalyticsOverview(range);
  const trendsQuery = useAnalyticsTrends(range, compare);
  const overview = overviewQuery.data ?? null;
  const trends = trendsQuery.data ?? null;
  const loading = overviewQuery.isFetching || trendsQuery.isFetching;

  const chartData = useMemo<ChartRow[]>(() => {
    if (!trends) return [];
    return trends.dates.map((date, index) => ({
      date,
      ...Object.fromEntries(trends.series.map((item) => [item.key, item.data[index] ?? 0])),
      // 上一周期按位对齐到主轴（虚拟对照）
      ...(trends.compare
        ? Object.fromEntries(trends.compare.series.map((item) => [`${item.key}_prev`, item.data[index] ?? 0]))
        : {}),
    }));
  }, [trends]);

  const trendSpec = useMemo(() => {
    const mainSeries = (trends?.series ?? []).map((item, index) => ({
      field: item.key,
      name: item.name,
      color: index === 0 ? palette.primary : ACCENT_COLORS[(index - 1) % ACCENT_COLORS.length],
    }));
    const compareSeries = trends?.compare
      ? trends.compare.series.map((item, index) => ({
          field: `${item.key}_prev`,
          name: `上期${item.name}`,
          color: `${index === 0 ? palette.primary : ACCENT_COLORS[(index - 1) % ACCENT_COLORS.length]}55`,
        }))
      : [];
    return makeLineSpec({
      data: chartData,
      xField: 'date',
      series: [...mainSeries, ...compareSeries],
      palette,
    });
  }, [chartData, palette, trends?.series, trends?.compare]);

  const cards = overview ? [
    { title: '浏览量 PV', value: numberText(overview.pv), icon: <Eye size={19} />, accent: palette.primary, sub: <DeltaText value={overview.pvDelta} /> },
    { title: '访客 UV', value: numberText(overview.uv), icon: <Users size={19} />, accent: '#22c55e', sub: <DeltaText value={overview.uvDelta} /> },
    { title: '会话', value: numberText(overview.sessions), icon: <Activity size={19} />, accent: '#8b5cf6', sub: <DeltaText value={overview.sessionsDelta} /> },
    { title: '事件', value: numberText(overview.events), icon: <Flame size={19} />, accent: '#f59e0b' },
    { title: '新增用户', value: numberText(overview.newUsers), icon: <TrendingUp size={19} />, accent: '#ef4444' },
    { title: '平均会话时长', value: msToReadable(overview.avgSessionMs), icon: <Clock size={19} />, accent: '#06b6d4' },
    { title: '跳出率', value: percentText(overview.bounceRate), icon: <Target size={19} />, accent: '#f97316', sub: <DeltaText value={overview.bounceRateDelta} suffix=" pts" /> },
    { title: '人均页数', value: overview.avgPagesPerSession.toFixed(2), icon: <BarChart3 size={19} />, accent: '#84cc16' },
    { title: '实时在线', value: numberText(overview.activeNow), icon: <Zap size={19} />, accent: '#ec4899' },
  ] : [];

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="行为概览"
        description="关键指标与趋势"
        extra={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Typography.Text type="tertiary" size="small">环比对照</Typography.Text>
              <Switch size="small" checked={compare} onChange={setCompare} />
            </div>
            <DatePicker
              type="dateRange"
              density="compact"
              placeholder="自定义日期区间"
              style={{ width: 240 }}
              onChange={(value) => {
                const [s, e] = Array.isArray(value) ? value : [];
                setCustomRange(s && e ? [formatDateForApi(s as Date), formatDateForApi(e as Date)] : null);
              }}
            />
            <Select value={days} optionList={DAYS_OPTIONS} disabled={!!customRange} onChange={(v) => setDays(Number(v))} style={{ width: 120 }} />
          </div>
        )}
      />
      {loading && !overview ? (
        <Skeleton
          loading
          active
          placeholder={
            <StatGrid minItemWidth={190}>
              {Array.from({ length: 9 }, (_, i) => `sk-stat-${i}`).map((key) => (
                <div key={key}>
                  <Skeleton.Title style={{ width: 64, height: 26, marginBottom: 10 }} />
                  <Skeleton.Paragraph rows={1} style={{ width: 80, marginBottom: 0 }} />
                </div>
              ))}
            </StatGrid>
          }
        >{null}</Skeleton>
      ) : <StatGrid minItemWidth={190}>{cards.map((card) => <StatCard key={String(card.title)} {...card} />)}</StatGrid>}
      <Card title="访问趋势" bodyStyle={{ padding: 16 }}>
        {chartData.length === 0 ? emptyOrSpin(loading) : (
          <LineChart {...trendSpec} options={chartOptions} height={300} />
        )}
      </Card>
    </div>
  );
}

function RealtimeTab() {
  const palette = useChartPalette();
  const queryClient = useQueryClient();
  const realtimeQuery = useAnalyticsRealtime();
  const data = realtimeQuery.data ?? null;
  const loading = realtimeQuery.isFetching;

  // 服务端有新事件入库时推送信号，即时刷新（10s 轮询保留兜底）
  useWebSocket(useCallback((msg) => {
    if (msg.type === 'analytics:ingest') void queryClient.invalidateQueries({ queryKey: analyticsKeys.realtime });
  }, [queryClient]));

  const realtimeAreaSpec = useMemo(() => makeAreaSpec({
    data: data?.perMinute ?? [],
    xField: 'minute',
    series: [{ field: 'events', name: '事件数', color: palette.primary }],
    palette,
  }), [data?.perMinute, palette]);

  return (
    <div style={sectionStyle}>
      <SectionHeader title="实时看板" description="事件推送即时刷新 · 每 10 秒轮询兜底" extra={<Button icon={<RefreshCcw size={14} />} onClick={() => void realtimeQuery.refetch()} loading={loading}>刷新</Button>} />
      <StatGrid minItemWidth={190}>
        <StatCard title="实时在线" value={numberText(data?.activeUsers ?? 0)} icon={<Users size={19} />} accent="#22c55e" />
        <StatCard title="近30分钟浏览" value={numberText(data?.pageViewsLast30Min ?? 0)} icon={<Eye size={19} />} accent={palette.primary} />
        <StatCard title="近1分钟事件" value={numberText(data?.eventsLastMinute ?? 0)} icon={<Zap size={19} />} accent="#f59e0b" />
      </StatGrid>
      <div className="chart-grid chart-grid--aside">
        <Card title="事件脉冲" bodyStyle={{ padding: 16 }}>
          {!data?.perMinute.length ? emptyOrSpin(loading) : (
            <AreaChart {...realtimeAreaSpec} options={chartOptions} height={300} />
          )}
        </Card>
        <Card title="热门在线页面" bodyStyle={{ padding: 16 }}>
          {!data?.topPages.length ? emptyOrSpin(loading, '暂无在线页面') : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.topPages.map((page) => (
                <div key={page.pagePath} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text strong ellipsis={{ showTooltip: true }}>{page.pageTitle || page.pagePath}</Typography.Text>
                    <div><Typography.Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>{page.pagePath}</Typography.Text></div>
                  </div>
                  <Tag color="blue">{page.active} 人</Tag>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card title="最新事件" bodyStyle={{ padding: 16 }}>
        {!data?.recentEvents.length ? emptyOrSpin(loading, '暂无事件') : (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.recentEvents.map((event, index) => (
              <div key={`${event.createdAt}-${index}`} style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr) 140px 170px', gap: 12, alignItems: 'center' }}>
                <Tag color="green">{event.eventType}</Tag>
                <Typography.Text ellipsis={{ showTooltip: true }}>{event.eventName || event.pagePath}</Typography.Text>
                <Typography.Text type="tertiary">{event.username || '匿名访客'}</Typography.Text>
                <Typography.Text type="tertiary">{formatDateTime(event.createdAt)}</Typography.Text>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

type PageStatsRow = PageStats['list'][number] & { id: string };
type MutableTreemapNode = {
  name: string;
  value?: number;
  children?: MutableTreemapNode[];
  [key: string]: unknown;
};

function getRouteSegments(pagePath: string): string[] {
  const parts = pagePath.split('/').filter(Boolean);
  return parts.length ? parts : ['首页'];
}

function addDwellPathNode(nodes: MutableTreemapNode[], segments: string[], row: PageStatsRow) {
  const [current, ...rest] = segments;
  if (!current) return;
  const isLeaf = rest.length === 0;
  const weight = Math.max(1, Math.round((row.avgMs ?? 0) * row.visits));
  const existing = nodes.find((node) => node.name === current);

  if (isLeaf) {
    const pageNode: MutableTreemapNode = {
      name: row.pageTitle || row.pagePath,
      value: weight,
      pagePath: row.pagePath,
      visits: row.visits,
      avgMs: row.avgMs,
      totalMs: weight,
    };
    if (existing) {
      existing.value = (existing.value ?? 0) + weight;
      existing.children = [...(existing.children ?? []), pageNode];
      return;
    }
    nodes.push(pageNode);
    return;
  }

  const branch = existing ?? { name: current, value: 0, children: [] };
  branch.value = (branch.value ?? 0) + weight;
  branch.children ??= [];
  if (!existing) nodes.push(branch);
  addDwellPathNode(branch.children, rest, row);
}

function sortTreemapNodes(nodes: TreemapNode[]): TreemapNode[] {
  return nodes
    .map((node) => ({ ...node, children: node.children ? sortTreemapNodes(node.children) : undefined }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

function buildDwellTreemap(rows: readonly PageStatsRow[]): TreemapNode {
  const children: MutableTreemapNode[] = [];
  for (const row of rows) {
    addDwellPathNode(children, getRouteSegments(row.pagePath), row);
  }
  return { name: '页面停留', children: sortTreemapNodes(children) };
}

function DwellTab() {
  const palette = useChartPalette();
  const [days, setDays] = useBehaviorDays();
  const { page, pageSize, resetPage, buildPagination } = usePagination();
  // 图表固定订阅第 1 页：它是 TOP N 概览，不能跟着表格翻页；
  // 表格停在第 1 页且页长相同时，TanStack 会把两个查询去重成一个请求
  const chartQuery = useAnalyticsPageStats(days, 1, CHART_TOP_N);
  const pageStatsQuery = useAnalyticsPageStats(days, page, pageSize);
  const data = pageStatsQuery.data ?? null;
  const loading = pageStatsQuery.isFetching;

  useEffect(() => { resetPage(); }, [days, resetPage]);

  const rows = useMemo<PageStatsRow[]>(() => (data?.list ?? []).map((item) => ({ ...item, id: item.pagePath })), [data]);
  const chartRows = useMemo<PageStatsRow[]>(
    () => (chartQuery.data?.list ?? []).map((item) => ({ ...item, id: item.pagePath })),
    [chartQuery.data],
  );
  const maxAvg = useMemo(() => Math.max(1, ...rows.map((item) => item.avgMs ?? 0)), [rows]);
  const avgDwell = data?.avgDwellMs ?? null;
  const dwellTreemapData = useMemo(() => buildDwellTreemap(chartRows), [chartRows]);
  const dwellTreemapSpec = useMemo(() => makeTreemapSpec({
    data: dwellTreemapData,
    palette,
    valueFormatter: msToReadable,
    tooltipItems: [
      { key: '总停留', value: (datum) => msToReadable(datumNumber(datum, 'totalMs') || datumNumber(datum, 'value')) },
      { key: '访问次数', value: (datum) => numberText(datumNumber(datum, 'visits')) },
      { key: '平均停留', value: (datum) => msToReadable(datumNumber(datum, 'avgMs')) },
    ],
  }), [dwellTreemapData, palette]);

  const columns: ColumnProps<PageStatsRow>[] = [
    {
      title: '页面',
      dataIndex: 'pagePath',
      width: 320,
      render: (_value, record) => (
        <div>
          <Typography.Text strong ellipsis={{ showTooltip: true }}>{record.pageTitle || record.pagePath}</Typography.Text>
          <div><Typography.Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>{record.pagePath}</Typography.Text></div>
        </div>
      ),
    },
    { title: '访问次数', dataIndex: 'visits', width: 120, align: 'right', render: (value) => numberText(Number(value)) },
    {
      title: '平均停留',
      align: 'right',
      dataIndex: 'avgMs',
      width: 220,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{msToReadable(record.avgMs)}</Typography.Text>
          <DataBar value={record.avgMs ?? 0} max={maxAvg} style={{ marginTop: 6 }} />
        </div>
      ),
    },
    { title: '中位数', dataIndex: 'medianMs', width: 120, align: 'right', render: (_value, record) => msToReadable(record.medianMs) },
    { title: 'P90', dataIndex: 'p90Ms', width: 120, align: 'right', render: (_value, record) => msToReadable(record.p90Ms) },
  ];

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="页面停留"
        description="页面访问深度与停留分布"
        extra={<Select value={days} optionList={DAYS_OPTIONS} onChange={(v) => setDays(Number(v))} style={{ width: 120 }} />}
      />
      <StatGrid minItemWidth={190}>
        <StatCard title="总访问" value={numberText(data?.totalVisits ?? 0)} icon={<Eye size={19} />} accent={palette.primary} />
        <StatCard title="统计页面" value={numberText(data?.total ?? 0)} icon={<BarChart3 size={19} />} accent="#8b5cf6" />
        <StatCard title="平均停留" value={msToReadable(avgDwell)} icon={<Clock size={19} />} accent="#06b6d4" />
      </StatGrid>
      <Card title={`页面停留热区 TOP ${CHART_TOP_N}`} bodyStyle={{ padding: 16 }}>
        {!chartRows.length ? emptyOrSpin(chartQuery.isFetching, '暂无页面停留数据') : (
          <TreemapChart {...dwellTreemapSpec} options={chartOptions} height={360} />
        )}
      </Card>
      <ConfigurableTable<PageStatsRow>
        bordered
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        onRefresh={() => void pageStatsQuery.refetch()}
        refreshLoading={loading}
        pagination={buildPagination(data?.total ?? 0)}
      />
    </div>
  );
}

type FeatureStatsRow = FeatureStats['list'][number] & { id: string; rank: number };

function getFeaturePageLabel(pagePath: string): string {
  if (pagePath === '/') return '首页';
  return pagePath;
}

function buildFeatureTreemap(rows: readonly FeatureStatsRow[]): TreemapNode {
  const pageMap = new Map<string, Map<string, FeatureStatsRow[]>>();

  for (const row of rows) {
    const area = row.componentArea || '未标记区域';
    const areaMap = pageMap.get(row.pagePath) ?? new Map<string, FeatureStatsRow[]>();
    const items = areaMap.get(area) ?? [];
    items.push(row);
    areaMap.set(area, items);
    pageMap.set(row.pagePath, areaMap);
  }

  const children = [...pageMap.entries()]
    .map(([pagePath, areaMap]) => {
      const areaChildren = [...areaMap.entries()]
        .reduce<TreemapNode[]>((result, [area, items]) => {
          const children = items.map((item) => ({
            name: elementDisplayName(item.elementLabel, item.elementKey),
            value: item.count,
            pagePath: item.pagePath,
            componentArea: item.componentArea,
            elementKey: item.elementKey,
          }));
          const value = items.reduce((sum, item) => sum + item.count, 0);

          if (area === '未标记区域') return result.concat(children);
          return result.concat({ name: area, value, children });
        }, [])
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

      return {
        name: getFeaturePageLabel(pagePath),
        value: areaChildren.reduce((sum, item) => sum + (item.value ?? 0), 0),
        pagePath,
        children: areaChildren,
      };
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return { name: '功能使用', children };
}

function FeatureTab() {
  const palette = useChartPalette();
  const [days, setDays] = useBehaviorDays();
  const { page, pageSize, resetPage, buildPagination } = usePagination();
  const chartQuery = useAnalyticsFeatureStats(days, 1, CHART_TOP_N);
  const featureStatsQuery = useAnalyticsFeatureStats(days, page, pageSize);
  const data = featureStatsQuery.data ?? null;
  const loading = featureStatsQuery.isFetching;

  useEffect(() => { resetPage(); }, [days, resetPage]);

  // 排名是全局序号，不能用当前页下标，否则第 2 页又从 #1 开始
  const rows = useMemo<FeatureStatsRow[]>(() => (data?.list ?? []).map((item, index) => ({
    ...item,
    id: `${item.pagePath}:${item.elementKey}:${index}`,
    rank: (page - 1) * pageSize + index + 1,
  })), [data, page, pageSize]);
  const chartRows = useMemo<FeatureStatsRow[]>(() => (chartQuery.data?.list ?? []).map((item, index) => ({
    ...item,
    id: `${item.pagePath}:${item.elementKey}:${index}`,
    rank: index + 1,
  })), [chartQuery.data]);
  const maxCount = useMemo(() => Math.max(1, ...rows.map((item) => item.count)), [rows]);
  const treemapData = useMemo(() => buildFeatureTreemap(chartRows), [chartRows]);
  const treemapSpec = useMemo(() => makeTreemapSpec({
    data: treemapData,
    palette,
    valueFormatter: numberText,
  }), [palette, treemapData]);

  const columns: ColumnProps<FeatureStatsRow>[] = [
    { title: '排名', dataIndex: 'rank', width: 90, render: (value) => <Tag color={Number(value) <= 3 ? 'orange' : 'grey'}>#{String(value)}</Tag> },
    {
      title: '功能',
      dataIndex: 'elementKey',
      width: 260,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{elementDisplayName(record.elementLabel, record.elementKey)}</Typography.Text>
          <div><Typography.Text type="tertiary" size="small">{record.elementKey}</Typography.Text></div>
        </div>
      ),
    },
    { title: 'UI区域', dataIndex: 'componentArea', width: 140, render: (_value, record) => (record.componentArea ? <Tag color="blue">{record.componentArea}</Tag> : <Tag color="grey">未标记</Tag>) },
    { title: '所在页面', dataIndex: 'pagePath', width: 260, render: (value) => <Typography.Text ellipsis={{ showTooltip: true }}>{String(value)}</Typography.Text> },
    {
      title: '使用次数',
      align: 'right',
      dataIndex: 'count',
      width: 240,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{numberText(record.count)}</Typography.Text>
          <DataBar value={record.count} max={maxCount} style={{ marginTop: 6 }} />
        </div>
      ),
    },
  ];

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="功能使用"
        description={`总事件 ${numberText(data?.totalEvents ?? 0)}`}
        extra={<Select value={days} optionList={DAYS_OPTIONS} onChange={(v) => setDays(Number(v))} style={{ width: 120 }} />}
      />
      <Card title={`功能热点 TOP ${CHART_TOP_N}`} bodyStyle={{ padding: 16 }}>
        {!chartRows.length ? emptyOrSpin(chartQuery.isFetching, '暂无功能使用数据') : (
          <TreemapChart {...treemapSpec} options={chartOptions} height={360} />
        )}
      </Card>
      <ConfigurableTable<FeatureStatsRow>
        bordered
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        onRefresh={() => void featureStatsQuery.refetch()}
        refreshLoading={loading}
        pagination={buildPagination(data?.total ?? 0)}
      />
    </div>
  );
}

type DeviceFilter = '' | 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

// 标签取 shared SSOT；颜色是时间轴 UI 表现，留在页面侧
const TIMELINE_EVENT_META: Record<string, { label: string; color: 'blue' | 'green' | 'orange' | 'grey' | 'red' | 'purple' }> = {
  page_view: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.page_view, color: 'blue' },
  page_leave: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.page_leave, color: 'grey' },
  feature_use: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.feature_use, color: 'green' },
  area_click: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.area_click, color: 'green' },
  api_request: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.api_request, color: 'orange' },
  perf: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.perf, color: 'purple' },
  custom: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.custom, color: 'purple' },
  identify: { label: USER_BEHAVIOR_EVENT_TYPE_LABELS.identify, color: 'grey' },
};

function SessionTimelineSheet({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const timelineQuery = useSessionTimeline(sessionId, sessionId != null);
  const data = timelineQuery.data ?? null;

  return (
    <SideSheet
      title="会话时间轴"
      visible={sessionId != null}
      onCancel={onClose}
      width={560}
    >
      <Spin spinning={timelineQuery.isFetching}>
        {!data ? <Empty description="暂无数据" /> : (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag color="blue">{data.username || (data.userId == null ? '匿名访客' : `用户 #${data.userId}`)}</Tag>
              <Tag>{data.deviceType || 'unknown'} · {data.browser || '–'} / {data.os || '–'}</Tag>
              {data.startedAt && <Tag color="grey">开始 {data.startedAt}</Tag>}
              {data.durationMs != null && <Tag color="grey">时长 {msToReadable(data.durationMs)}</Tag>}
            </div>
            {data.items.length === 0 ? <Empty description="该会话暂无事件明细" /> : (
              <Timeline mode="left">
                {data.items.map((item) => {
                  const meta = TIMELINE_EVENT_META[item.eventType] ?? { label: item.eventType, color: 'grey' as const };
                  return (
                    <Timeline.Item
                      key={item.id}
                      time={item.createdAt.slice(11)}
                      type={item.eventType === 'api_request' ? 'warning' : item.eventType === 'page_view' ? 'ongoing' : 'default'}
                    >
                      <div style={{ display: 'grid', gap: 2 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Tag size="small" color={meta.color}>{meta.label}</Tag>
                          <Typography.Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 320 }}>
                            {item.eventType === 'feature_use' || item.eventType === 'area_click'
                              ? item.elementLabel || item.eventName || '–'
                              : item.pageTitle || item.pagePath}
                          </Typography.Text>
                        </div>
                        <Typography.Text size="small" type="tertiary" ellipsis={{ showTooltip: true }} style={{ maxWidth: 420 }}>
                          {item.pagePath}
                          {item.componentArea ? ` · ${item.componentArea}` : ''}
                          {item.durationMs != null ? ` · ${msToReadable(item.durationMs)}` : ''}
                        </Typography.Text>
                      </div>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            )}
          </div>
        )}
      </Spin>
    </SideSheet>
  );
}

function SessionsTab() {
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState('');
  const [deviceInput, setDeviceInput] = useState<DeviceFilter>('');
  const [filters, setFilters] = useState({ username: '', deviceType: '' as DeviceFilter });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [timelineSessionId, setTimelineSessionId] = useState<string | null>(null);
  const sessionsQuery = useAnalyticsSessions({
    page,
    pageSize,
    username: filters.username || undefined,
    deviceType: filters.deviceType || undefined,
  });
  const data = sessionsQuery.data ?? { list: [], total: 0, page: 1, pageSize: 20 };

  const handleSearch = () => {
    setPage(1);
    setFilters({ username: usernameInput.trim(), deviceType: deviceInput });
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.sessionsLists });
  };

  const handleReset = () => {
    setUsernameInput('');
    setDeviceInput('');
    setPage(1);
    setFilters({ username: '', deviceType: '' });
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.sessionsLists });
  };

  const columns: ColumnProps<SessionListItem>[] = [
    { title: '用户', dataIndex: 'username', width: 150, render: (_value, record) => record.username || (record.userId == null ? '匿名访客' : `用户 #${record.userId}`) },
    { title: '入口页', dataIndex: 'entryPage', width: 200, render: (_value, record) => <Typography.Text ellipsis={{ showTooltip: true }}>{record.entryPage || '–'}</Typography.Text> },
    { title: '出口页', dataIndex: 'exitPage', width: 200, render: (_value, record) => <Typography.Text ellipsis={{ showTooltip: true }}>{record.exitPage || '–'}</Typography.Text> },
    { title: '页数', dataIndex: 'pageCount', width: 90, align: 'right' },
    { title: '事件', dataIndex: 'eventCount', width: 90, align: 'right' },
    { title: '时长', dataIndex: 'durationMs', width: 120, align: 'right', render: (_value, record) => msToReadable(record.durationMs) },
    {
      title: '设备 / 浏览器 / 系统',
      dataIndex: 'deviceType',
      width: 230,
      render: (_value, record) => (
        <div>
          <Tag color="blue">{record.deviceType || 'unknown'}</Tag>
          <Typography.Text size="small" type="tertiary"> {record.browser || '–'} / {record.os || '–'}</Typography.Text>
        </div>
      ),
    },
    { title: '地域', dataIndex: 'region', width: 120, render: (_value, record) => record.region || '–' },
    { title: '跳出', dataIndex: 'isBounce', width: 90, render: (_value, record) => <Tag color={record.isBounce ? 'red' : 'green'}>{record.isBounce ? '是' : '否'}</Tag> },
    dateTimeColumn('开始时间', 'startedAt'),
    {
      title: '操作',
      dataIndex: 'sessionId',
      width: 90,
      fixed: 'right',
      render: (_value, record) => (
        <Button theme="borderless" size="small" onClick={() => setTimelineSessionId(record.sessionId)}>时间轴</Button>
      ),
    },
  ];

  const renderUsernameSearch = () => (
    <Input
      prefix={<Search size={14} />}
      placeholder="用户名"
      value={usernameInput}
      showClear
      onChange={setUsernameInput}
      onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
      style={{ width: 200 }}
    />
  );
  const renderDeviceFilter = () => (
    <Select
      value={deviceInput}
      optionList={DEVICE_OPTIONS}
      onChange={(v) => setDeviceInput(String(v ?? '') as DeviceFilter)}
      style={{ width: 150 }}
    />
  );
  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;

  return (
    <div style={sectionStyle}>
      <SearchToolbar
        primary={(
          <>
            {renderUsernameSearch()}
            {renderDeviceFilter()}
            {renderSearchButton()}
            {renderResetButton()}
          </>
        )}
        mobilePrimary={(
          <>
            {renderUsernameSearch()}
            {renderSearchButton()}
          </>
        )}
        mobileFilters={renderDeviceFilter()}
        filterTitle="会话筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />
      <ConfigurableTable<SessionListItem>
        bordered
        columns={columns}
        dataSource={data.list}
        loading={sessionsQuery.isFetching}
        rowKey="id"
        onRefresh={() => void sessionsQuery.refetch()}
        refreshLoading={sessionsQuery.isFetching}
        pagination={{
          currentPage: page,
          pageSize,
          total: data.total,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
      <SessionTimelineSheet sessionId={timelineSessionId} onClose={() => setTimelineSessionId(null)} />
    </div>
  );
}

interface FunnelStepDraft {
  id: string;
  label: string;
  pagePath?: string;
  eventName?: string;
  propKey?: string;
  propOp?: AnalyticsSegmentPropertyFilter['op'];
  propValue?: string;
}

function buildStepProperties(step: FunnelStepDraft): AnalyticsSegmentPropertyFilter[] | undefined {
  const key = step.propKey?.trim();
  if (!key) return undefined;
  const op = step.propOp ?? 'eq';
  const raw = step.propValue?.trim() ?? '';
  const value = op === 'in' ? raw.split(',').map((v) => v.trim()).filter(Boolean) : raw;
  return [{ key, op, value }];
}

function FunnelTab() {
  const palette = useChartPalette();
  const [days, setDays] = useBehaviorDays();
  const [conversionWindowHours, setConversionWindowHours] = useState(72);
  const [comparison, setComparison] = useState<AnalyticsComparison>({ type: 'none' });
  const drill = useDrillSheet();
  const [steps, setSteps] = useState<FunnelStepDraft[]>([
    { id: 'step-1', label: '进入首页', pagePath: '/' },
    { id: 'step-2', label: '进入仪表盘', pagePath: '/dashboard' },
  ]);
  const analyzeMutation = useAnalyzeFunnel();
  const result = analyzeMutation.data ?? null;
  const loading = analyzeMutation.isPending;
  const savedReportsQuery = useSavedFunnelReports();
  const savedReports = savedReportsQuery.data?.list ?? [];
  const saveReportMutation = useSaveFunnelReport();
  const deleteReportMutation = useDeleteFunnelReport();
  const [saveName, setSaveName] = useState('');
  const [saveVisible, setSaveVisible] = useState(false);

  const saveReport = async () => {
    const name = saveName.trim();
    if (!name) { Toast.warning('请输入报表名称'); return; }
    await saveReportMutation.mutateAsync({
      name,
      config: {
        days,
        conversionWindowHours,
        comparison,
        steps: steps.map(({ label, pagePath, eventName, propKey, propOp, propValue }) => ({ label, pagePath, eventName, propKey, propOp, propValue })),
      },
    });
    Toast.success('已保存');
    setSaveVisible(false);
    setSaveName('');
  };

  const loadReport = (report: AnalyticsSavedReport) => {
    const config = report.config as {
      days?: number;
      conversionWindowHours?: number;
      comparison?: AnalyticsComparison;
      steps?: Array<{ label?: string; pagePath?: string; eventName?: string; propKey?: string; propOp?: AnalyticsSegmentPropertyFilter['op']; propValue?: string }>;
    };
    if (config.days) setDays(config.days);
    setConversionWindowHours(config.conversionWindowHours ?? 72);
    setComparison(config.comparison ?? { type: 'none' });
    if (Array.isArray(config.steps) && config.steps.length >= 2) {
      setSteps(config.steps.map((s, i) => ({
        id: `step-${Date.now()}-${i}`,
        label: s.label ?? `步骤 ${i + 1}`,
        pagePath: s.pagePath,
        eventName: s.eventName,
        propKey: s.propKey,
        propOp: s.propOp,
        propValue: s.propValue,
      })));
    }
    Toast.info(`已加载「${report.name}」`);
  };

  const updateStep = (id: string, patch: Partial<Omit<FunnelStepDraft, 'id'>>) => {
    setSteps((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { id: `step-${Date.now()}`, label: `步骤 ${prev.length + 1}`, eventName: '' }]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => (prev.length <= 2 ? prev : prev.filter((item) => item.id !== id)));
  };

  // 多序列时图表按序列分组展示各步转化率；单序列沿用原有的横向条形
  const funnelChartData = useMemo(() => {
    const series = result?.series ?? [];
    if (series.length === 0) return [];
    if (series.length === 1) {
      return (series[0].steps ?? []).map((step, index) => ({ ...step, __fill: chartColor(index, palette.primary) }));
    }
    return (series[0].steps ?? []).map((step, stepIndex) => {
      const row: Record<string, unknown> = { label: step.label };
      series.forEach((s) => { row[s.key] = s.steps[stepIndex]?.conversionRate ?? 0; });
      return row;
    });
  }, [palette.primary, result?.series]);

  const funnelBarSpec = useMemo(() => {
    const series = result?.series ?? [];
    const multi = series.length > 1;
    return makeBarSpec({
      data: funnelChartData,
      xField: 'label',
      series: multi
        ? series.map((s, i) => ({ field: s.key, name: s.label, color: chartColor(i, palette.primary) }))
        : [{ field: 'conversionRate', name: '总转化率', color: palette.primary }],
      palette,
      horizontal: !multi,
      categoryAxisWidth: multi ? undefined : 96,
      colorByDatum: multi ? undefined : (datum) => String(datum?.__fill ?? palette.primary),
      tooltip: { value: (value) => `${Number(value).toFixed(1)}%` },
      axis: { yLabel: (value) => `${value}%` },
    });
  }, [funnelChartData, palette, result?.series]);

  const funnelSteps = useMemo(() => steps.map((step) => ({
    label: step.label.trim(),
    pagePath: step.pagePath?.trim() || undefined,
    eventName: step.eventName?.trim() || undefined,
    properties: buildStepProperties(step),
  })), [steps]);

  const analyze = async () => {
    if (!isComparisonReady(comparison)) { Toast.warning('请至少选择一个对比分群'); return; }
    await analyzeMutation.mutateAsync({ days, conversionWindowHours, comparison, steps: funnelSteps });
  };

  /** 点击某序列某步的「已转化 / 已流失」→ 下钻出具体用户 */
  const openDrill = (seriesKey: string, seriesLabel: string, stepIndex: number, outcome: 'converted' | 'dropped', stepLabel: string) => {
    drill.open(
      { type: 'funnel', days, steps: funnelSteps, conversionWindowHours, comparison, seriesKey, stepIndex, outcome },
      `${stepLabel} · ${outcome === 'converted' ? '已转化用户' : '流失用户'}`,
      comparison.type === 'none' ? undefined : `对比序列：${seriesLabel}`,
    );
  };

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="转化漏斗"
        description="组合页面与事件步骤，按时间先后顺序分析用户转化（支持转化窗口与分群过滤）"
        extra={<Select value={days} optionList={DAYS_OPTIONS} onChange={(v) => setDays(Number(v))} style={{ width: 120 }} />}
      />
      <Card bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Typography.Text type="tertiary" size="small">转化窗口（小时）</Typography.Text>
            <InputNumber value={conversionWindowHours} min={1} max={720} onChange={(v) => setConversionWindowHours(Number(v) || 72)} style={{ width: 120 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Typography.Text type="tertiary" size="small">对比</Typography.Text>
            <ComparisonPicker value={comparison} onChange={setComparison} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {steps.map((step, index) => (
            <div key={step.id} style={{ display: 'grid', gridTemplateColumns: '40px minmax(110px, 0.9fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) minmax(100px, 0.7fr) 84px minmax(100px, 0.7fr) 36px', gap: 8, alignItems: 'center' }}>
              <Tag color="blue">#{index + 1}</Tag>
              <Input placeholder="步骤名称" value={step.label} onChange={(value) => updateStep(step.id, { label: value })} />
              <Input placeholder="页面路径（可选）" value={step.pagePath ?? ''} onChange={(value) => updateStep(step.id, { pagePath: value })} />
              <Input placeholder="事件名（可选）" value={step.eventName ?? ''} onChange={(value) => updateStep(step.id, { eventName: value })} />
              <Input placeholder="属性key（可选）" value={step.propKey ?? ''} onChange={(value) => updateStep(step.id, { propKey: value })} />
              <Select
                value={step.propOp ?? 'eq'}
                optionList={ANALYTICS_SEGMENT_COMPARE_OP_OPTIONS}
                onChange={(v) => updateStep(step.id, { propOp: v as AnalyticsSegmentPropertyFilter['op'] })}
                disabled={!step.propKey}
              />
              <Input placeholder="属性值" value={step.propValue ?? ''} onChange={(value) => updateStep(step.id, { propValue: value })} disabled={!step.propKey} />
              <Button icon={<Trash2 size={14} />} type="danger" theme="borderless" disabled={steps.length <= 2} onClick={() => removeStep(step.id)} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Button icon={<Plus size={14} />} onClick={addStep}>添加步骤</Button>
          <Button type="primary" icon={<Target size={14} />} loading={loading} disabled={steps.length < 2} onClick={() => void analyze()}>分析</Button>
          <Button icon={<Bookmark size={14} />} onClick={() => setSaveVisible(true)}>保存配置</Button>
          <Dropdown
            trigger="click"
            position="bottomLeft"
            render={(
              <Dropdown.Menu>
                {savedReports.length === 0 && <Dropdown.Item disabled>暂无保存的漏斗</Dropdown.Item>}
                {savedReports.map((report) => (
                  <Dropdown.Item key={report.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadReport(report)}>{report.name}</span>
                      <Button
                        theme="borderless"
                        type="danger"
                        size="small"
                        icon={<Trash2 size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete({
                            title: `删除报表「${report.name}」？`,
                            onOk: () => deleteReportMutation.mutateAsync(report.id).then(() => Toast.success('已删除')),
                          });
                        }}
                      />
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            )}
          >
            <Button loading={savedReportsQuery.isFetching}>加载配置 ({savedReports.length})</Button>
          </Dropdown>
        </div>
        <Modal
          title="保存漏斗配置"
          visible={saveVisible}
          onCancel={() => setSaveVisible(false)}
          onOk={() => void saveReport()}
          confirmLoading={saveReportMutation.isPending}
        >
          <Input placeholder="报表名称，如「注册转化漏斗」" value={saveName} onChange={setSaveName} />
        </Modal>
      </Card>
      <Card title="漏斗结果" bodyStyle={{ padding: 16 }}>
        {!result || result.series.length === 0 ? emptyOrSpin(loading, '请配置步骤后点击分析') : (
          <div style={{ display: 'grid', gap: 18 }}>
            <BarChart {...funnelBarSpec} options={chartOptions} height={300} />
            {result.series.map((series, seriesIndex) => (
              <div key={series.key} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {result.series.length > 1 && (
                    <Space spacing={6} align="center">
                      <span
                        aria-hidden
                        style={{ width: 8, height: 8, borderRadius: '50%', background: chartColor(seriesIndex, palette.primary), display: 'inline-block' }}
                      />
                      <Typography.Text strong>{series.label}</Typography.Text>
                    </Space>
                  )}
                  <Tag color="blue">总用户 {numberText(series.totalUsers)}</Tag>
                  <Tag color="green">整体转化 {percentText(series.overallConversionRate)}</Tag>
                </div>
                {series.steps.map((step, index) => (
                  <div key={`${series.key}-${step.label}-${index}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                      <Typography.Text strong>{step.label}</Typography.Text>
                      <Space spacing={8} wrap>
                        <Typography.Text>
                          {numberText(step.users)} 人 · 总转化 {percentText(step.conversionRate)} · 上步转化 {percentText(step.stepConversionRate)} · 流失 {numberText(step.dropoff)}
                          {step.averageConversionMs != null ? ` · 平均耗时 ${msToReadable(step.averageConversionMs)}` : ''}
                        </Typography.Text>
                        <Button theme="borderless" size="small" disabled={step.users === 0} onClick={() => openDrill(series.key, series.label, index, 'converted', step.label)}>看用户</Button>
                        {index > 0 && (
                          <Button theme="borderless" size="small" disabled={step.dropoff === 0} onClick={() => openDrill(series.key, series.label, index, 'dropped', step.label)}>看流失</Button>
                        )}
                      </Space>
                    </div>
                    <DataBar
                      value={step.conversionRate}
                      max={100}
                      minPercent={2}
                      color={chartColor(index, palette.primary)}
                      track="var(--semi-color-fill-0)"
                      height={20}
                      radius={999}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
      <DrillUsersSheet context={drill.context} title={drill.title} description={drill.description} onClose={drill.close} />
    </div>
  );
}

function RetentionTab() {
  const [periodType, setPeriodType] = useState<AnalyticsRetentionPeriodType>('day');
  const [days, setDays] = useState(ANALYTICS_RETENTION_PERIOD_LIMITS.day.defaultDays);
  const [maxPeriods, setMaxPeriods] = useState(ANALYTICS_RETENTION_PERIOD_LIMITS.day.defaultPeriods);
  const [mode, setMode] = useState<AnalyticsRetentionMode>('first_seen');
  const [comparison, setComparison] = useState<AnalyticsComparison>({ type: 'none' });
  const drill = useDrillSheet();
  // 分群对比未选分群时不发请求：请求体过不了 schema 校验，只会白白拿一个 400
  const effectiveComparison = isComparisonReady(comparison) ? comparison : { type: 'none' as const };
  const retentionQuery = useAnalyticsRetention({ days, mode, periodType, maxPeriods, comparison: effectiveComparison });
  const data = retentionQuery.data ?? null;
  const loading = retentionQuery.isFetching;

  // 切换粒度时回溯窗口与列数必须一起改：60 天窗口配月留存只有 2 个队列，12 列全是空的
  const handlePeriodTypeChange = (next: AnalyticsRetentionPeriodType) => {
    setPeriodType(next);
    setDays(ANALYTICS_RETENTION_PERIOD_LIMITS[next].defaultDays);
    setMaxPeriods(ANALYTICS_RETENTION_PERIOD_LIMITS[next].defaultPeriods);
  };

  const periodUnit = ANALYTICS_RETENTION_PERIOD_UNIT_LABELS[periodType];
  const series = data?.series ?? [];
  // 色阶基准取全部序列的最大值，多序列之间颜色深浅才可直接横向比较
  const periodMax = series.length
    ? Math.max(1, ...series.flatMap((s) => s.cohorts.flatMap((c) => c.values.filter((v): v is number => v != null))))
    : 100;

  const openDrill = (seriesKey: string, seriesLabel: string, cohortDate: string, periodIndex: number, outcome: 'retained' | 'churned') => {
    drill.open(
      { type: 'retention', days, mode, periodType, comparison: effectiveComparison, seriesKey, cohortDate, periodIndex, outcome },
      `${cohortDate} 队列 · 第 ${periodIndex} ${periodUnit} · ${outcome === 'retained' ? '回访用户' : '未回访用户'}`,
      effectiveComparison.type === 'none' ? undefined : `对比序列：${seriesLabel}`,
    );
  };

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="用户留存"
        description="按首访周期形成 cohort，单元格颜色越深表示留存率越高；点击单元格可下钻到具体用户"
        extra={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Select
              value={periodType}
              optionList={ANALYTICS_RETENTION_PERIOD_TYPE_OPTIONS}
              onChange={(v) => handlePeriodTypeChange(v as AnalyticsRetentionPeriodType)}
              style={{ width: 120 }}
            />
            <Select
              value={mode}
              optionList={ANALYTICS_RETENTION_MODE_OPTIONS}
              onChange={(v) => setMode(v as AnalyticsRetentionMode)}
              style={{ width: 160 }}
            />
            <Select value={days} optionList={RETENTION_DAYS_OPTIONS[periodType]} onChange={(v) => setDays(Number(v))} style={{ width: 130 }} />
            <Select value={maxPeriods} optionList={retentionPeriodOptions(periodType)} onChange={(v) => setMaxPeriods(Number(v))} style={{ width: 140 }} />
            <ComparisonPicker value={comparison} onChange={setComparison} />
          </div>
        )}
      />
      <Typography.Text type="tertiary" size="small">
        {mode === 'first_seen'
          ? '真实首访口径：按用户全历史首次出现周期分组，仅展示首访周期落在统计区间内的 cohort'
          : '窗口首现口径：按当前统计窗口内首次出现周期分组（与旧版行为一致）'}
      </Typography.Text>
      {loading && !data ? <Card bodyStyle={{ padding: 16 }}>{emptyOrSpin(true)}</Card>
        : series.length === 0 ? <Card bodyStyle={{ padding: 16 }}><Empty description="暂无留存数据" /></Card>
          : series.map((s) => (
            <Card
              key={s.key}
              title={series.length > 1 ? `${s.label}（${numberText(s.totalUsers)} 人）` : undefined}
              bodyStyle={{ padding: 16, overflowX: 'auto' }}
            >
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4, minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px 8px 10px', fontSize: 12, color: 'var(--semi-color-text-2)', fontWeight: 500, width: '1%', whiteSpace: 'nowrap' }}>同期群</th>
                    <th style={{ textAlign: 'right', padding: '8px 14px 8px 10px', fontSize: 12, color: 'var(--semi-color-text-2)', fontWeight: 500, width: '1%', whiteSpace: 'nowrap' }}>人数</th>
                    {(data?.periods ?? []).map((period) => <th key={period} style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, color: 'var(--semi-color-text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>{`第 ${period} ${periodUnit}`}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 12px 8px 10px', fontWeight: 600, whiteSpace: 'nowrap', width: '1%', color: 'var(--semi-color-text-2)' }}>加权平均</td>
                    <td style={{ padding: '8px 14px 8px 10px', textAlign: 'right', color: 'var(--semi-color-text-2)', whiteSpace: 'nowrap', width: '1%' }}>–</td>
                    {s.averages.map((value, index) => (
                      <td key={index} style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--semi-color-text-2)', fontWeight: 600 }}>
                        {value == null ? '·' : `${value.toFixed(1)}%`}
                      </td>
                    ))}
                  </tr>
                  {s.cohorts.map((cohort) => (
                    <tr key={cohort.cohortDate}>
                      <td style={{ padding: '8px 12px 8px 10px', fontWeight: 600, whiteSpace: 'nowrap', width: '1%' }}>{cohort.cohortDate}</td>
                      <td style={{ padding: '8px 14px 8px 10px', textAlign: 'right', color: 'var(--semi-color-text-1)', whiteSpace: 'nowrap', width: '1%' }}>{numberText(cohort.cohortSize)}</td>
                      {(data?.periods ?? []).map((period, index) => {
                        const value = cohort.values[index];
                        const ratio = value == null ? 0 : Math.min(1, value / periodMax);
                        const opacity = value == null ? 0 : 0.12 + ratio * 0.73;
                        const drillable = value != null && cohort.cohortSize > 0;
                        return (
                          <td
                            key={period}
                            title={drillable ? '点击查看该周期回访的用户' : undefined}
                            style={{
                              textAlign: 'center',
                              padding: 0,
                              borderRadius: 'var(--semi-border-radius-medium)',
                              fontSize: 12,
                              fontVariantNumeric: 'tabular-nums',
                              background: value == null ? 'transparent' : `color-mix(in srgb, var(--semi-color-primary) ${Math.round(opacity * 100)}%, transparent)`,
                              color: value == null ? 'var(--semi-color-text-3)' : ratio > 0.55 ? '#ffffff' : 'var(--semi-color-text-0)',
                            }}
                          >
                            {drillable ? (
                              <button
                                type="button"
                                onClick={() => openDrill(s.key, s.label, cohort.cohortDate, index, 'retained')}
                                style={{
                                  width: '100%', padding: '8px 6px', border: 'none', background: 'transparent',
                                  color: 'inherit', font: 'inherit', cursor: 'pointer', borderRadius: 'inherit',
                                }}
                              >
                                {`${value.toFixed(1)}%`}
                              </button>
                            ) : (
                              <span style={{ display: 'inline-block', padding: '8px 6px' }}>{value == null ? '·' : `${value.toFixed(1)}%`}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
      <DrillUsersSheet context={drill.context} title={drill.title} description={drill.description} onClose={drill.close} />
    </div>
  );
}

const PATH_EXIT_COLOR = '#94a3b8';

function pathNodeText(label: string): string {
  if (label === ANALYTICS_PATH_EXIT_PAGE) return '退出';
  return label === '/' ? '首页' : label;
}

function pathNodeShortText(label: string): string {
  if (label === ANALYTICS_PATH_EXIT_PAGE) return '退出';
  const segments = getRouteSegments(label);
  return segments[segments.length - 1];
}

/** 页面 → 稳定色号：同一页面出现在不同步序上必须同色，否则看不出它在路径中反复出现 */
function buildPageColorIndex(labels: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const label of labels) {
    if (label === ANALYTICS_PATH_EXIT_PAGE || map.has(label)) continue;
    map.set(label, map.size);
  }
  return map;
}

const PATH_LINK_LIMIT_OPTIONS = [
  { label: 'Top 20 链路', value: 20 },
  { label: 'Top 30 链路', value: 30 },
  { label: 'Top 50 链路', value: 50 },
  { label: 'Top 100 链路', value: 100 },
];

type PathLinkRow = PathLink & { id: string; sourceLabel: string; targetLabel: string };

function PathTab() {
  const palette = useChartPalette();
  const [days, setDays] = useBehaviorDays();
  const [linkLimit, setLinkLimit] = useState(30);
  const [startPageInput, setStartPageInput] = useState('');
  const [startPage, setStartPage] = useState('');
  const { page, pageSize, resetPage, buildPagination } = usePagination();
  const pathQuery = useAnalyticsPath(days, startPage || undefined, linkLimit);
  const data = pathQuery.data ?? null;
  const loading = pathQuery.isFetching;

  useEffect(() => { resetPage(); }, [days, linkLimit, startPage, resetPage]);

  const nodes = useMemo(() => data?.nodes ?? [], [data]);
  const links = useMemo(() => data?.links ?? [], [data]);
  // 桑基布局无法表达回边，只喂非回边；被排除的部分在图下方与明细表如实标出
  const acyclicLinks = useMemo(() => links.filter((link) => !link.cyclic), [links]);
  const nodeLabelMap = useMemo(() => new Map(nodes.map((node) => [node.id, node.label])), [nodes]);
  const pageColorIndex = useMemo(() => buildPageColorIndex(nodes.map((node) => node.label)), [nodes]);

  const sankeySpec = useMemo(() => makeSankeySpec({
    nodes: nodes.map((node) => ({ ...node })),
    links: acyclicLinks.map((link) => ({ ...link })),
    palette,
    nodeColor: (node) => (node.label === ANALYTICS_PATH_EXIT_PAGE
      ? PATH_EXIT_COLOR
      : chartColor(pageColorIndex.get(String(node.label)) ?? 0, palette.primary)),
    nodeLabel: (node) => pathNodeShortText(String(node.label)),
    valueFormatter: numberText,
    tooltip: {
      nodeTitle: (datum) => pathNodeText(datumText(datum, 'label')),
      nodeItems: [
        { key: '流量', value: (datum) => `${numberText(datumNumber(datum, 'value'))} 次` },
      ],
      linkTitle: (datum) => {
        const source = pathNodeText(nodeLabelMap.get(datumText(datum, 'source')) ?? '');
        const target = pathNodeText(nodeLabelMap.get(datumText(datum, 'target')) ?? '');
        return `${source} → ${target}`;
      },
      linkItems: [
        { key: '跳转', value: (datum) => `${numberText(datumNumber(datum, 'value'))} 次` },
      ],
    },
  }), [acyclicLinks, nodeLabelMap, nodes, pageColorIndex, palette]);

  const rows = useMemo<PathLinkRow[]>(() => [...links]
    .sort((a, b) => b.value - a.value)
    .map((link, index) => ({
      ...link,
      id: `${link.source}-${link.target}-${index}`,
      sourceLabel: pathNodeText(nodeLabelMap.get(link.source) ?? link.source),
      targetLabel: pathNodeText(nodeLabelMap.get(link.target) ?? link.target),
    })), [links, nodeLabelMap]);
  const maxValue = useMemo(() => Math.max(1, ...rows.map((row) => row.value)), [rows]);
  // 图与表同源（都来自这一次查询的 links），表格在本地切页即可，不需要再发一次请求
  const pagedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

  const columns: ColumnProps<PathLinkRow>[] = [
    { title: '来源页面', dataIndex: 'sourceLabel', render: (value) => renderEllipsis(String(value)) },
    {
      title: '去向页面',
      dataIndex: 'targetLabel',
      render: (_value, record) => (record.targetLabel === '退出'
        ? <Tag color="grey">退出</Tag>
        : renderEllipsis(record.targetLabel)),
    },
    {
      title: '跳转次数',
      align: 'right',
      dataIndex: 'value',
      width: 220,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{numberText(record.value)}</Typography.Text>
          <DataBar value={record.value} max={maxValue} style={{ marginTop: 6 }} />
        </div>
      ),
    },
    {
      title: '图中展示',
      dataIndex: 'cyclic',
      width: 130,
      render: (_value, record) => (record.cyclic
        ? <Tag color="orange">回流·未入图</Tag>
        : <Tag color="green">已入图</Tag>),
    },
  ];

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="页面跳转路径"
        description="会话内全部相邻跳转"
        extra={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input
              prefix={<Search size={14} />}
              placeholder="起点页面（可选），如 /users"
              value={startPageInput}
              showClear
              onChange={setStartPageInput}
              onClear={() => setStartPage('')}
              onKeyDown={(e) => { if (e.key === 'Enter') setStartPage(startPageInput.trim()); }}
              style={{ width: 220 }}
            />
            <SearchButton onClick={() => setStartPage(startPageInput.trim())} />
            <Select value={linkLimit} optionList={PATH_LINK_LIMIT_OPTIONS} onChange={(v) => setLinkLimit(Number(v))} style={{ width: 150 }} />
            <Select value={days} optionList={DAYS_OPTIONS} onChange={(v) => setDays(Number(v))} style={{ width: 120 }} />
          </div>
        )}
      />
      <StatGrid minItemWidth={190}>
        <StatCard title="跳转总次数" value={numberText(data?.totalTransitions ?? 0)} icon={<Activity size={19} />} accent={palette.primary} />
        <StatCard title="展示链路" value={numberText(links.length)} icon={<BarChart3 size={19} />} accent="#8b5cf6" />
        <StatCard title="回流未入图" value={numberText(data?.cyclicValue ?? 0)} icon={<RefreshCcw size={19} />} accent="#f59e0b" />
      </StatGrid>
      <Card title="路径流" bodyStyle={{ padding: 16 }}>
        {!acyclicLinks.length ? emptyOrSpin(loading, '暂无路径数据') : (
          <div>
            <SankeyChart {...sankeySpec} options={chartOptions} height={420} />
            <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginTop: 10 }}>
              节点是页面，灰色为退出（会话结束）；按跳转量取前 {linkLimit} 条链路
              {links.length > acyclicLinks.length
                ? `；其中 ${links.length - acyclicLinks.length} 条回流链路（页面互跳）无法在桑基图中表达，已在下方明细表标出`
                : ''}
              {startPage ? `；仅显示从 ${startPage} 可达的部分` : ''}
            </Typography.Text>
          </div>
        )}
      </Card>
      <Card title="跳转明细" bodyStyle={{ padding: 16 }}>
        {!rows.length ? emptyOrSpin(loading, '暂无路径数据') : (
          <ConfigurableTable<PathLinkRow>
            bordered
            columns={columns}
            dataSource={pagedRows}
            loading={loading}
            rowKey="id"
            onRefresh={() => void pathQuery.refetch()}
            refreshLoading={loading}
            pagination={buildPagination(rows.length)}
          />
        )}
      </Card>
    </div>
  );
}

type UserStatsRow = UserStats['list'][number] & { id: string; rank: number };

function UsersTab() {
  const [days, setDays] = useBehaviorDays();
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineUserId, setTimelineUserId] = useState<number | null>(null);
  const { page, pageSize, resetPage, buildPagination } = usePagination();
  const userStatsQuery = useAnalyticsUserStats(days, page, pageSize);
  const timelineQuery = useAnalyticsUserTimeline(timelineUserId, timelineVisible);
  const data = userStatsQuery.data ?? null;
  const loading = userStatsQuery.isFetching;
  const timeline = timelineQuery.data ?? null;
  const timelineLoading = timelineQuery.isFetching;

  useEffect(() => { resetPage(); }, [days, resetPage]);

  const rows = useMemo<UserStatsRow[]>(() => (data?.list ?? []).map((item, index) => ({
    ...item,
    id: item.userId == null ? `anonymous-${index}` : String(item.userId),
    rank: (page - 1) * pageSize + index + 1,
  })), [data, page, pageSize]);
  const maxEvents = Math.max(1, ...rows.map((item) => item.totalEvents));

  const openTimeline = (record: UserStatsRow) => {
    if (record.userId == null) return;
    setTimelineUserId(record.userId);
    setTimelineVisible(true);
  };

  const columns: ColumnProps<UserStatsRow>[] = [
    {
      title: '用户',
      dataIndex: 'username',
      width: 210,
      render: (_value, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size="small" color={record.userId == null ? 'grey' : 'blue'}>{(record.username || '访').slice(0, 1).toUpperCase()}</Avatar>
          <div>
            <Typography.Text strong>{record.username || (record.userId == null ? '匿名访客' : `用户 #${record.userId}`)}</Typography.Text>
            <div><Typography.Text type="tertiary" size="small">#{record.rank}</Typography.Text></div>
          </div>
        </div>
      ),
    },
    {
      title: '总操作',
      align: 'right',
      dataIndex: 'totalEvents',
      width: 220,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{numberText(record.totalEvents)}</Typography.Text>
          <DataBar value={record.totalEvents} max={maxEvents} style={{ marginTop: 6 }} />
        </div>
      ),
    },
    { title: '页面访问', dataIndex: 'pageViews', width: 110 },
    { title: '访问页面数', dataIndex: 'uniquePages', width: 120 },
    { title: '功能使用', dataIndex: 'featureUses', width: 110 },
    { title: '总停留', dataIndex: 'totalDwellMs', width: 130, align: 'right', render: (_value, record) => msToReadable(record.totalDwellMs) },
    dateTimeColumn('最近活跃', 'lastActiveAt', { fixed: 'right' }),
  ];

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="用户分析"
        description={`覆盖用户 ${numberText(data?.total ?? 0)}`}
        extra={<Select value={days} optionList={DAYS_OPTIONS} onChange={(v) => setDays(Number(v))} style={{ width: 120 }} />}
      />
      <ConfigurableTable<UserStatsRow>
        bordered
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowKey="id"
        onRefresh={() => void userStatsQuery.refetch()}
        refreshLoading={loading}
        pagination={buildPagination(data?.total ?? 0)}
        onRow={(record) => ({
          onClick: () => { if (record) openTimeline(record); },
          style: { cursor: record?.userId == null ? 'default' : 'pointer' },
        })}
      />
      <SideSheet
        title="用户行为时间线"
        visible={timelineVisible}
        width={560}
        onCancel={() => setTimelineVisible(false)}
      >
        <Spin spinning={timelineLoading}>
          {!timeline ? <Empty description="暂无时间线" /> : (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <Typography.Title heading={5} style={{ margin: 0 }}>{timeline.username || `用户 #${timeline.userId}`}</Typography.Title>
                <Typography.Text type="tertiary">
                  共 {numberText(timeline.totalEvents)} 次行为 · {timeline.firstSeenAt ? formatDateTime(timeline.firstSeenAt) : '–'} 至 {timeline.lastSeenAt ? formatDateTime(timeline.lastSeenAt) : '–'}
                </Typography.Text>
              </div>
              {timeline.items.map((item) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: 12, position: 'relative' }}>
                  <Typography.Text type="tertiary" size="small">{formatDateTime(item.createdAt)}</Typography.Text>
                  <div>
                    <Tag color="blue">{item.eventType}</Tag>
                    <Typography.Text strong style={{ marginLeft: 8 }}>{item.eventName || item.elementLabel || item.pageTitle || item.pagePath}</Typography.Text>
                    <div><Typography.Text type="tertiary" size="small">{item.componentArea || '页面'} · {item.pagePath} · {msToReadable(item.durationMs)}</Typography.Text></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Spin>
      </SideSheet>
    </div>
  );
}


// 人均重复点击 → 颜色：1 次/人是正常点击，越高说明少数人在同一处反复点，通常是交互失效信号
const REPEAT_RATE_SCALE = [
  { min: 4, color: '#dc2626', label: '≥4 次/人' },
  { min: 2.5, color: '#f97316', label: '2.5–4 次/人' },
  { min: 1.5, color: '#f59e0b', label: '1.5–2.5 次/人' },
  { min: 0, color: '#22c55e', label: '<1.5 次/人' },
];

function repeatRateColor(rate: number): string {
  return (REPEAT_RATE_SCALE.find((item) => rate >= item.min) ?? REPEAT_RATE_SCALE[REPEAT_RATE_SCALE.length - 1]).color;
}

function ClickScatter({ data }: Readonly<{ data: HeatmapData }>) {
  const palette = useChartPalette();
  const spec = useMemo(() => {
    const maxValue = Math.max(1, ...data.points.map((point) => point.value));
    // 大小编码点击次数，颜色编码人均重复点击 —— 两个通道各自承载一个指标，不再冗余
    const sizeRatio = (datum: ChartDatum) => Math.max(0.12, Math.min(1, datumNumber(datum, 'value') / maxValue));
    return makeScatterSpec({
      data: data.points,
      dataId: 'clicks',
      xField: 'x',
      yField: 'y',
      palette,
      padding: { top: 12, right: 16, bottom: 28, left: 36 },
      xAxis: { min: 0, max: 100, label: (value) => `${value}%` },
      yAxis: { min: 0, max: 100, inverse: true, label: (value) => `${value}%` },
      point: {
        size: (datum) => 8 + 34 * sizeRatio(datum),
        fill: (datum) => repeatRateColor(datumNumber(datum, 'repeatRate')),
        fillOpacity: 0.5,
        // 挫败点击命中的落点加深色描边，与下方 rage 榜单联动
        stroke: (datum) => (datumBoolean(datum, 'rage') ? '#7f1d1d' : palette.bg1),
        lineWidth: (datum) => (datumBoolean(datum, 'rage') ? 2.5 : 1),
      },
      tooltip: {
        title: (datum) => datumText(datum, 'topLabel') || `位置 (${datumNumber(datum, 'x')}%, ${datumNumber(datum, 'y')}%)`,
        items: [
          { key: '点击次数', value: (datum) => `${datumNumber(datum, 'value')} 次` },
          { key: '点击人数', value: (datum) => `${datumNumber(datum, 'uniqueUsers')} 人` },
          { key: '人均重复', value: (datum) => `${datumNumber(datum, 'repeatRate')} 次/人` },
          { key: 'UI区域', value: (datum) => datumText(datum, 'topArea') || '未标记' },
          { key: '位置', value: (datum) => `${datumNumber(datum, 'x')}%, ${datumNumber(datum, 'y')}%` },
          { key: '挫败点击', value: (datum) => (datumBoolean(datum, 'rage') ? '是（该元素存在连点）' : '否') },
        ],
      },
    });
  }, [data, palette]);

  return <ScatterChart {...spec} options={chartOptions} height={360} />;
}

function ScatterLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
      <Typography.Text type="tertiary" size="small">点大小 = 点击次数；颜色 = 人均重复点击</Typography.Text>
      {REPEAT_RATE_SCALE.map((item) => (
        <Space key={item.label} spacing={6}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, opacity: 0.75 }} />
          <Typography.Text type="tertiary" size="small">{item.label}</Typography.Text>
        </Space>
      ))}
      <Space spacing={6}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'transparent', border: '2.5px solid #7f1d1d' }} />
        <Typography.Text type="tertiary" size="small">存在挫败点击</Typography.Text>
      </Space>
    </div>
  );
}

type HeatmapElementRow = HeatmapElementItem & { id: string; rank: number };
type RageClickRow = HeatmapRageClickItem & { id: string };

function HeatmapTab() {
  const [days, setDays] = useBehaviorDays();
  const [pagePath, setPagePath] = useState('');
  const [componentArea, setComponentArea] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceFilter>('');
  const [source, setSource] = useState('');
  const pagesQuery = useAnalyticsHeatmapPages(days);
  const pages = pagesQuery.data?.pages ?? EMPTY_HEATMAP_PAGES;
  const heatmapQuery = useAnalyticsHeatmap(pagePath, componentArea, days, deviceType, source);
  const data = heatmapQuery.data ?? null;
  const pagesLoading = pagesQuery.isFetching;
  const loading = heatmapQuery.isFetching;

  useEffect(() => {
    const nextPage = pages.find((item) => item.pagePath === pagePath) ?? pages[0];
    setPagePath(nextPage?.pagePath ?? '');
    setComponentArea((prev) => (prev && nextPage?.areas.includes(prev) ? prev : ''));
  }, [pages, pagePath]);

  const selectedPage = useMemo(() => pages.find((item) => item.pagePath === pagePath), [pagePath, pages]);
  const pageOptions = useMemo(() => pages.map((item) => ({ label: item.pageTitle ? `${item.pageTitle} · ${item.pagePath}` : item.pagePath, value: item.pagePath })), [pages]);
  const areaOptions = useMemo(() => [
    { label: '全页（自动采集）', value: '' },
    ...(selectedPage?.areas ?? []).map((area) => ({ label: area, value: area })),
  ], [selectedPage]);

  useEffect(() => {
    if (!selectedPage) return;
    if (componentArea && !selectedPage.areas.includes(componentArea)) setComponentArea('');
  }, [componentArea, selectedPage]);

  const elementRows = useMemo<HeatmapElementRow[]>(
    () => (data?.topElements ?? []).map((item, index) => ({ ...item, id: item.elementKey, rank: index + 1 })),
    [data],
  );
  const maxElementCount = useMemo(() => Math.max(1, ...elementRows.map((item) => item.count)), [elementRows]);
  const rageRows = useMemo<RageClickRow[]>(
    () => (data?.rageClicks ?? []).map((item, index) => ({ ...item, id: `${item.elementKey ?? 'unknown'}:${index}` })),
    [data],
  );

  const cards = data ? [
    { title: '点击次数', value: numberText(data.total), icon: <Flame size={19} />, accent: '#ef4444' },
    { title: '点击访客', value: numberText(data.uniqueUsers), icon: <Users size={19} />, accent: '#22c55e' },
    { title: '点击会话', value: numberText(data.uniqueSessions), icon: <Activity size={19} />, accent: '#8b5cf6' },
    { title: '人均点击', value: data.avgClicksPerUser.toFixed(1), icon: <BarChart3 size={19} />, accent: '#06b6d4' },
  ] : [];

  const elementColumns: ColumnProps<HeatmapElementRow>[] = [
    { title: '排名', dataIndex: 'rank', width: 80, render: (value) => <Tag color={Number(value) <= 3 ? 'orange' : 'grey'}>#{String(value)}</Tag> },
    {
      title: '元素',
      dataIndex: 'elementKey',
      width: 240,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{elementDisplayName(record.elementLabel, record.elementKey)}</Typography.Text>
          <div><Typography.Text type="tertiary" size="small">{record.elementKey}</Typography.Text></div>
        </div>
      ),
    },
    { title: 'UI区域', dataIndex: 'componentArea', width: 130, render: (_value, record) => (record.componentArea ? <Tag color="blue">{record.componentArea}</Tag> : <Tag color="grey">未标记</Tag>) },
    { title: '平均落点', dataIndex: 'avgX', width: 120, render: (_value, record) => <Typography.Text type="tertiary">{record.avgX == null || record.avgY == null ? '–' : `${record.avgX}% , ${record.avgY}%`}</Typography.Text> },
    { title: '点击人数', dataIndex: 'uniqueUsers', width: 110, align: 'right', render: (value) => numberText(Number(value)) },
    {
      title: '点击次数',
      align: 'right',
      dataIndex: 'count',
      width: 200,
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{numberText(record.count)}</Typography.Text>
          <DataBar value={record.count} max={maxElementCount} style={{ marginTop: 6 }} />
        </div>
      ),
    },
  ];

  const rageColumns: ColumnProps<RageClickRow>[] = [
    {
      title: '元素',
      dataIndex: 'elementKey',
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{record.elementLabel || record.elementKey || '未识别元素'}</Typography.Text>
          <div><Typography.Text type="tertiary" size="small">{record.elementKey}</Typography.Text></div>
        </div>
      ),
    },
    { title: '发生次数', dataIndex: 'count', width: 110, align: 'right', render: (value) => <Tag color="red">{numberText(Number(value))}</Tag> },
    { title: '影响人数', dataIndex: 'uniqueUsers', width: 110, align: 'right', render: (value) => numberText(Number(value)) },
    dateTimeColumn('最近发生', 'lastAt'),
  ];

  return (
    <div style={sectionStyle}>
      <SectionHeader
        title="点击分布"
        description="页面区域点击落点分布"
        extra={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Select value={days} optionList={DAYS_OPTIONS} onChange={(v) => setDays(Number(v))} style={{ width: 120 }} />
            <Select placeholder="选择页面" value={pagePath || undefined} optionList={pageOptions} loading={pagesLoading} onChange={(v) => setPagePath(String(v ?? ''))} style={{ width: 280 }} />
            <Select placeholder="选择区域" value={componentArea} optionList={areaOptions} onChange={(v) => setComponentArea(String(v ?? ''))} style={{ width: 180 }} />
            <Select value={deviceType} optionList={DEVICE_OPTIONS} onChange={(v) => setDeviceType(String(v ?? '') as DeviceFilter)} style={{ width: 140 }} />
            <Select value={source} optionList={HEATMAP_SOURCE_OPTIONS} onChange={(v) => setSource(String(v ?? ''))} style={{ width: 150 }} />
          </div>
        )}
      />
      <Typography.Text type="tertiary" size="small">
        落点坐标是视口百分比，桌面端与移动端的分布不可直接比较，建议按设备分开查看
      </Typography.Text>
      <StatGrid minItemWidth={190}>{cards.map((card) => <StatCard key={String(card.title)} {...card} />)}</StatGrid>
      <Card title="落点分布" bodyStyle={{ padding: 16 }}>
        <Spin spinning={loading}>
          {!data?.points.length ? <Empty description="暂无点击数据" /> : (
            <div>
              <ClickScatter data={data} />
              <ScatterLegend />
              <Typography.Text type="tertiary" style={{ display: 'block', marginTop: 10 }}>
                {numberText(data.total)} 次点击 · {data.pagePath} · {data.componentArea || '全页'}
              </Typography.Text>
            </div>
          )}
        </Spin>
      </Card>
      <Card title="热点元素 TOP 10" bodyStyle={{ padding: 16 }}>
        {!elementRows.length ? emptyOrSpin(loading, '暂无带元素标识的点击') : (
          <ConfigurableTable<HeatmapElementRow>
            bordered
            columns={elementColumns}
            dataSource={elementRows}
            loading={loading}
            rowKey="id"
            onRefresh={() => void heatmapQuery.refetch()}
            refreshLoading={loading}
            pagination={false}
          />
        )}
      </Card>
      <Card title="挫败点击（连点无响应）" bodyStyle={{ padding: 16 }}>
        {!rageRows.length ? emptyOrSpin(loading, '该页面暂无挫败点击') : (
          <ConfigurableTable<RageClickRow>
            bordered
            columns={rageColumns}
            dataSource={rageRows}
            loading={loading}
            rowKey="id"
            onRefresh={() => void heatmapQuery.refetch()}
            refreshLoading={loading}
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
}

const BEHAVIOR_TABS = ['overview', 'realtime', 'event-query', 'experiments', 'dwell', 'feature', 'sessions', 'funnel', 'retention', 'path', 'users', 'heatmap', 'acquisition'] as const;

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useUrlTabState(BEHAVIOR_TABS, 'overview');
  return (
    <div className="page-container page-tabs-page zx-flat-panels">
      <BehaviorDaysProvider>
      <Tabs collapsible="auto" type="line" lazyRender activeKey={activeTab} onChange={(key) => setActiveTab(key as typeof BEHAVIOR_TABS[number])}>
        <TabPane tab="概览" itemKey="overview"><OverviewTab /></TabPane>
        <TabPane tab="实时" itemKey="realtime"><RealtimeTab /></TabPane>
        <TabPane tab="事件分析" itemKey="event-query"><AnalyticsEventQueryTab /></TabPane>
        <TabPane tab="A/B 实验" itemKey="experiments"><AnalyticsExperimentsTab /></TabPane>
        <TabPane tab="页面停留" itemKey="dwell"><DwellTab /></TabPane>
        <TabPane tab="功能使用" itemKey="feature"><FeatureTab /></TabPane>
        <TabPane tab="会话" itemKey="sessions"><SessionsTab /></TabPane>
        <TabPane tab="漏斗" itemKey="funnel"><FunnelTab /></TabPane>
        <TabPane tab="留存" itemKey="retention"><RetentionTab /></TabPane>
        <TabPane tab="路径" itemKey="path"><PathTab /></TabPane>
        <TabPane tab="用户分析" itemKey="users"><UsersTab /></TabPane>
        <TabPane tab="点击分布" itemKey="heatmap"><HeatmapTab /></TabPane>
        <TabPane tab="获客归因" itemKey="acquisition"><AnalyticsAcquisitionTab /></TabPane>
      </Tabs>
      </BehaviorDaysProvider>
    </div>
  );
}
