import { useMemo } from 'react';
import { formatYuan } from '@/utils/payment';
import type { CSSProperties } from 'react';
import { Banner, Checkbox, Select, Spin } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { BarChart, chartOptions, makeBarSpec, useChartPalette, StatCard, StatGrid } from '@/components/charts';
import ConfigurableTable from '@/components/ConfigurableTable';
import { SearchToolbar } from '@/components/SearchToolbar';
import { formatDateTimeForApi } from '@/utils/date';
import { usePermission } from '@/hooks/usePermission';
import { paymentReportKeys, usePaymentReportSummary } from '@/hooks/queries/payment-reports';
import { useListSearch } from '@/hooks/useListSearch';
import { PAYMENT_REPORT_GROUP_BY_LABELS } from '@zenith/shared/payment';
import type { PaymentReportGroupBy, PaymentReportRow } from '@zenith/shared/payment';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { DateRangeFilter } from '@/components/search-filters';

const yuan = formatYuan;
const groupByOptions = Object.entries(PAYMENT_REPORT_GROUP_BY_LABELS).map(([value, label]) => ({ value, label }));

const sectionStyle: CSSProperties = { background: 'var(--semi-color-bg-1)', border: '1px solid var(--semi-color-border)', borderRadius: 'var(--semi-border-radius-medium)', padding: '16px 20px' };

/** 环比增幅：上一周期为 0 时不显示 */
function calcDelta(cur: number, prev: number | undefined | null): number | null {
  if (prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}

interface SearchParams { groupBy: PaymentReportGroupBy; timeRange: [Date, Date] | null; compare: boolean; }
const defaultSearch: SearchParams = { groupBy: 'bizType', timeRange: null, compare: false };

export default function PaymentReportsPage() {
  const { hasPermission } = usePermission();
  const canView = hasPermission('payment:report:view');
  const palette = useChartPalette();
  const {
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearch, listKey: paymentReportKeys.lists });
  const summaryQuery = usePaymentReportSummary({
    groupBy: submittedParams.groupBy,
    startTime: submittedParams.timeRange ? formatDateTimeForApi(submittedParams.timeRange[0]) : undefined,
    endTime: submittedParams.timeRange ? formatDateTimeForApi(submittedParams.timeRange[1]) : undefined,
    compare: submittedParams.compare && submittedParams.timeRange ? 'true' : undefined,
  }, canView);
  const summary = summaryQuery.data ?? null;
  const prev = summary?.prev ?? null;
  const loading = summaryQuery.isFetching;

  const chartData = useMemo(
    () => (summary?.rows ?? []).map((r) => ({ name: r.label, 收款: Number((r.gross / 100).toFixed(2)), 净额: Number((r.net / 100).toFixed(2)) })),
    [summary?.rows],
  );
  const barSpec = useMemo(
    () =>
      makeBarSpec({
        data: chartData,
        xField: 'name',
        series: [
          { field: '收款', name: '收款', color: '#10b981' },
          { field: '净额', name: '净额', color: '#3b82f6' },
        ],
        palette,
        tooltip: { value: (v) => `¥${v}` },
        axis: { yLabel: (v) => `¥${v}` },
      }),
    [chartData, palette],
  );

  const columns: ColumnProps<PaymentReportRow>[] = [
    { title: PAYMENT_REPORT_GROUP_BY_LABELS[summary?.groupBy ?? 'bizType'], dataIndex: 'label', width: 160 },
    { title: '收款', dataIndex: 'gross', width: 130, render: (v: number) => yuan(v) },
    { title: '手续费', dataIndex: 'fee', width: 120, render: (v: number) => yuan(v) },
    { title: '退款', dataIndex: 'refund', width: 120, render: (v: number) => yuan(v) },
    { title: '净额', dataIndex: 'net', width: 130, render: (v: number) => yuan(v) },
    { title: '成功笔数', dataIndex: 'count', width: 100 },
  ];

  const renderGroupByFilter = () => (
    <Select
      value={draftParams.groupBy}
      onChange={(v) => setDraftParams((p) => ({ ...p, groupBy: v as PaymentReportGroupBy }))}
      style={{ width: 140 }}
      optionList={groupByOptions}
      placeholder="选择维度"
    />
  );

  const renderTimeRangeFilter = () => (
    <DateRangeFilter value={draftParams.timeRange ?? undefined} onChange={(v) => setDraftParams((p) => ({ ...p, timeRange: v ? (v as [Date, Date]) : null }))} width={330} />
  );

  const renderCompareToggle = () => (
    <Checkbox
      checked={draftParams.compare}
      onChange={(e) => setDraftParams((p) => ({ ...p, compare: Boolean(e.target.checked) }))}
      disabled={!draftParams.timeRange}
    >
      环比对照
    </Checkbox>
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} disabled={!canView} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} disabled={!canView} />;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderGroupByFilter()}
            {renderTimeRangeFilter()}
            {renderCompareToggle()}
            {renderSearchButton()}
            {renderResetButton()}
          </>
        )}
        mobilePrimary={renderSearchButton()}
        mobileFilters={(
          <>
            {renderGroupByFilter()}
            {renderTimeRangeFilter()}
            {renderCompareToggle()}
          </>
        )}
        filterTitle="财务报表筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      {!canView && (
        <Banner
          type="warning"
          bordered
          closeIcon={null}
          description="当前账号缺少「payment:report:view」权限，无法查看财务报表。"
          style={{ marginBottom: 12 }}
        />
      )}

      <Spin spinning={loading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StatGrid minItemWidth={168}>
            <StatCard title="收款总额" value={summary ? yuan(summary.totalGross) : '—'} accent="var(--semi-color-success)" deltaLabel="环比" deltaFormat="ratio" delta={summary && prev ? calcDelta(summary.totalGross, prev.totalGross) : null} />
            <StatCard title="手续费总额" value={summary ? yuan(summary.totalFee) : '—'} accent="var(--semi-color-warning)" deltaLabel="环比" deltaFormat="ratio" delta={summary && prev ? calcDelta(summary.totalFee, prev.totalFee) : null} />
            <StatCard title="退款总额" value={summary ? yuan(summary.totalRefund) : '—'} accent="var(--semi-color-warning)" deltaLabel="环比" deltaFormat="ratio" delta={summary && prev ? calcDelta(summary.totalRefund, prev.totalRefund) : null} />
            <StatCard title="净额" value={summary ? yuan(summary.totalNet) : '—'} accent="var(--semi-color-primary)" deltaLabel="环比" deltaFormat="ratio" delta={summary && prev ? calcDelta(summary.totalNet, prev.totalNet) : null} />
            <StatCard title="成功笔数" value={summary?.totalCount ?? '—'} deltaLabel="环比" deltaFormat="ratio" delta={summary && prev ? calcDelta(summary.totalCount, prev.totalCount) : null} />
          </StatGrid>

          <div style={sectionStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>收款 / 净额分布</div>
            <BarChart {...barSpec} options={chartOptions} height={300} />
          </div>

          <ConfigurableTable
            bordered columns={columns} dataSource={summary?.rows ?? []} loading={loading} rowKey="key" size="small" empty="暂无数据"
            onRefresh={() => void summaryQuery.refetch()} refreshLoading={loading} pagination={false}
          />
        </div>
      </Spin>
    </div>
  );
}
