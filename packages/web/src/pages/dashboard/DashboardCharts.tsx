/**
 * 首页仪表盘图表区（仅管理员可见的三张 VChart 卡片）。
 *
 * 独立成懒加载 chunk：'@/components/charts' 模块求值即接入 VChart 主题，
 * 会拖入 ~1.9MB 的 @visactor 依赖树。拆出后 DashboardPage 主体
 * （欢迎横幅/统计卡/公告/日历）先渲染，图表随本 chunk 就绪后流式补齐。
 */
import { useMemo } from 'react';
import { Card, Typography, Skeleton, Empty } from '@douyinfe/semi-ui';
import {
  AreaChart,
  LineChart,
  PieChart,
  chartOptions,
  makeAreaSpec,
  makeLineSpec,
  makePieSpec,
  useChartPalette,
} from '@/components/charts';
import type { DashboardCharts } from '@/hooks/queries/dashboard';

const { Text } = Typography;

const PIE_COLORS = [
  '#4A90E2', '#52C41A', '#FA8C16', '#13C2C2',
  '#722ED1', '#F5222D', '#EB2F96', '#1677FF',
];

function shortDate(dateStr: string) {
  return dateStr.slice(5); // MM-DD
}

const chartCardSkeleton = (
  <div className="dashboard-chart-placeholder">
    <Skeleton active loading placeholder={
      <div style={{ width: '100%', height: 200, padding: '12px 0' }}>
        <Skeleton.Paragraph rows={6} style={{ width: '100%' }} />
      </div>
    } />
  </div>
);

interface DashboardChartsRowProps {
  readonly charts: DashboardCharts | null;
  readonly chartsLoading: boolean;
}

export default function DashboardChartsRow({ charts, chartsLoading }: DashboardChartsRowProps) {
  const palette = useChartPalette();

  const loginTrendSpec = useMemo(() => makeLineSpec({
    data: charts?.loginTrend ?? [],
    xField: 'date',
    series: [
      { field: 'successCount', name: '成功', color: '#52C41A' },
      { field: 'failCount', name: '失败', color: '#F5222D' },
    ],
    palette,
    point: true,
    axis: { xLabel: shortDate },
    tooltip: { title: (x) => `日期：${x}` },
  }), [charts?.loginTrend, palette]);

  const userActivitySpec = useMemo(() => makeAreaSpec({
    data: charts?.userActivity ?? [],
    xField: 'date',
    series: [{ field: 'activeUsers', name: '活跃用户', color: '#4A90E2' }],
    palette,
    point: true,
    axis: { xLabel: shortDate },
    tooltip: { title: (x) => `日期：${x}` },
  }), [charts?.userActivity, palette]);

  function renderOperationPie() {
    if (chartsLoading) return (
      <div className="dashboard-chart-placeholder">
        <Skeleton active loading placeholder={
          <div style={{ width: '100%', height: 200, display: 'flex', alignItems: 'flex-end', gap: 12, padding: '0 8px' }}>
            {[60, 80, 45, 90, 55, 70].map((h) => (
              <Skeleton.Button key={h} style={{ flex: 1, height: `${h}%`, borderRadius: 'var(--semi-border-radius-small)' }} />
            ))}
          </div>
        } />
      </div>
    );
    const pieData = charts?.operationTypes ?? [];
    if (pieData.length === 0) {
      return <div className="dashboard-chart-placeholder"><Empty description="今日暂无操作记录" /></div>;
    }
    const coloredData = pieData.map((item, idx) => ({ ...item, fill: PIE_COLORS[idx % PIE_COLORS.length] }));
    const operationPieSpec = makePieSpec({
      data: coloredData,
      categoryField: 'module',
      valueField: 'count',
      donut: false,
      colors: coloredData.map((d) => d.fill),
      palette,
      label: 'percent',
      valueUnit: '次',
    });
    return (
      <PieChart {...operationPieSpec} options={chartOptions} height={200} />
    );
  }

  return (
    <div className="dashboard-charts-row">
      {/* 7 天登录趋势 */}
      <Card
        title={<Text strong style={{ fontSize: 14 }}>7 天登录趋势</Text>}
        className="dashboard-card dashboard-chart-card"
        bodyStyle={{ padding: '12px 16px 8px' }}
      >
        {chartsLoading
          ? chartCardSkeleton
          : (
            <LineChart {...loginTrendSpec} options={chartOptions} height={200} />
          )
        }
      </Card>

      {/* 今日操作类型分布 */}
      <Card
        title={<Text strong style={{ fontSize: 14 }}>今日操作分布</Text>}
        className="dashboard-card dashboard-chart-card"
        bodyStyle={{ padding: '12px 16px 8px' }}
      >
        {renderOperationPie()}
      </Card>

      {/* 用户活跃度曲线 */}
      <Card
        title={<Text strong style={{ fontSize: 14 }}>7 天用户活跃度</Text>}
        className="dashboard-card dashboard-chart-card"
        bodyStyle={{ padding: '12px 16px 8px' }}
      >
        {chartsLoading
          ? chartCardSkeleton
          : (
            <AreaChart {...userActivitySpec} options={chartOptions} height={200} />
          )
        }
      </Card>
    </div>
  );
}
