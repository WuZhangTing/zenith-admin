import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DatePicker, Select, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { RuleDecisionExecution } from '@zenith/shared/rules';
import { SearchToolbar } from '@/components/SearchToolbar';
import ConfigurableTable from '@/components/ConfigurableTable';
import { usePagination } from '@/hooks/usePagination';
import { ruleKeys, useRuleExecutions } from '@/hooks/queries/rules';
import { formatDateTimeRangeValuesForApi } from '@/utils/date';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { dateTimeColumn } from '@/utils/table-columns';
import { JsonBlock } from '@/components/JsonBlock';

const { Text } = Typography;

const SOURCE_META: Record<string, { text: string; color: 'blue' | 'purple' | 'cyan' }> = {
  runtime: { text: '运行时', color: 'blue' },
  manual: { text: '手动', color: 'purple' },
  test: { text: '测试', color: 'cyan' },
};

interface Filters {
  ruleKey?: string;
  source?: 'runtime' | 'manual' | 'test';
  matched?: boolean;
  dateStart?: string;
  dateEnd?: string;
}

/** 规则中心 · 决策执行记录（跨表 trace / 审计） */
export default function RuleExecutionsPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, buildPagination } = usePagination();
  const [draft, setDraft] = useState<Filters>({});
  const [submitted, setSubmitted] = useState<Filters>({});

  const listQuery = useRuleExecutions({ page, pageSize, ...submitted });
  const data = listQuery.data ?? null;

  const handleSearch = () => {
    setPage(1);
    setSubmitted(draft);
    void queryClient.invalidateQueries({ queryKey: ruleKeys.decisionTables.all });
  };
  const handleReset = () => {
    setDraft({});
    setSubmitted({});
    setPage(1);
    void queryClient.invalidateQueries({ queryKey: ruleKeys.decisionTables.all });
  };

  const columns: ColumnProps<RuleDecisionExecution>[] = [
    dateTimeColumn('时间', 'createdAt'),
    { title: '决策表 Key', dataIndex: 'ruleKey', width: 170, render: (t: string) => <Text code>{t}</Text> },
    { title: '来源', dataIndex: 'source', width: 90, render: (s: string) => <Tag size="small" color={SOURCE_META[s]?.color}>{SOURCE_META[s]?.text ?? s}</Tag> },
    { title: '结果', dataIndex: 'matched', width: 90, render: (m: boolean) => <Tag size="small" color={m ? 'green' : 'red'}>{m ? '命中' : '未命中'}</Tag> },
    { title: '命中行', width: 130, render: (_: unknown, r: RuleDecisionExecution) => <Text type="tertiary" size="small">{r.matchedRowIds.join(', ') || '-'}</Text> },
    { title: '流程实例', width: 130, render: (_: unknown, r: RuleDecisionExecution) => (r.instanceId ? <Text type="tertiary" size="small">#{r.instanceId}{r.nodeKey ? ` · ${r.nodeKey}` : ''}</Text> : '-') },
    { title: '输出', render: (_: unknown, r: RuleDecisionExecution) => <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ maxWidth: 320 }}>{JSON.stringify(r.outputs)}</Text> },
  ];

  /** 行内展开：命中策略上下文 + 输入 / 输出双栏对比 */
  const renderExpanded = (r?: RuleDecisionExecution) => (r ? (
    <div style={{ display: 'grid', gap: 12, padding: '4px 0' }}>
      <Space spacing={8} wrap>
        <Tag size="small">{r.hitPolicy}</Tag>
        <Text type="tertiary" size="small" code>{r.ruleKey}{r.tableId ? ` (#${r.tableId})` : ''}</Text>
        {r.instanceId && <Text type="tertiary" size="small">实例 #{r.instanceId}{r.nodeKey ? ` · 节点 ${r.nodeKey}` : ''}</Text>}
      </Space>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Text strong size="small">输入</Text>
          <JsonBlock value={r.input} style={{ marginTop: 4 }} />
        </div>
        <div>
          <Text strong size="small">输出</Text>
          <JsonBlock value={r.outputs} style={{ marginTop: 4 }} />
        </div>
      </div>
    </div>
  ) : null);

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            <KeywordInput placeholder="决策表 Key" value={draft.ruleKey ?? ''} onChange={(v) => setDraft((p) => ({ ...p, ruleKey: v || undefined }))} onSearch={handleSearch} width={200} />
            <Select placeholder="来源" value={draft.source} onChange={(v) => setDraft((p) => ({ ...p, source: v as Filters['source'] }))} optionList={[{ value: 'runtime', label: '运行时' }, { value: 'manual', label: '手动' }, { value: 'test', label: '测试' }]} showClear style={{ width: 120 }} />
            <Select placeholder="结果" value={draft.matched === undefined ? undefined : String(draft.matched)} onChange={(v) => setDraft((p) => ({ ...p, matched: v === undefined ? undefined : v === 'true' }))} optionList={[{ value: 'true', label: '命中' }, { value: 'false', label: '未命中' }]} showClear style={{ width: 110 }} />
            <DatePicker
              type="dateTimeRange"
              value={draft.dateStart && draft.dateEnd ? [draft.dateStart, draft.dateEnd] : undefined}
              onChange={(dates) => {
                const range = dates as Date[] | undefined;
                const [dateStart, dateEnd] = formatDateTimeRangeValuesForApi(range);
                setDraft((p) => ({
                  ...p,
                  dateStart,
                  dateEnd,
                }));
              }}
              style={{ width: 360 }}
            />
            <SearchButton onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
      />
      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={data?.list ?? []}
        loading={listQuery.isFetching}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无执行记录"
        pagination={buildPagination(data?.total ?? 0)}
        expandedRowRender={renderExpanded}
        hideExpandedColumn={false}
        expandRowByClick
      />
    </div>
  );
}
