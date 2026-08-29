/**
 * 会话回放中心：回放会话列表 + 详情侧栏（播放器 / 触发器 / 关联错误）。
 * 支持 ?replay={id} 直达（错误监控「查看回放」跳转入口）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Checkbox, Descriptions, Select, SideSheet, Space, Tag, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Trash2 } from 'lucide-react';
import type { ReplaySession, ReplayTriggerType } from '@zenith/shared/analytics';
import ConfigurableTable from '@/components/ConfigurableTable';
import ReplayPlayer from '@/components/ReplayPlayer';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput } from '@/components/search-filters';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { dateTimeColumn } from '@/utils/table-columns';
import { formatBytesMb } from '@/utils/format';
import { confirmDelete } from '@/utils/confirm';
import { useListSearch } from '@/hooks/useListSearch';
import { StatCard, StatGrid } from '@/components/charts';
import { replayKeys, useBatchDeleteReplays, useReplayDetail, useReplayList, useReplayStorageStats } from '@/hooks/queries/session-replays';

const { Text } = Typography;

interface SearchParams {
  status: string;
  triggerType: string;
  source: string;
  keyword: string;
  hasError: boolean;
  pagePath: string;
  clickLabel: string;
}

const defaultSearchParams: SearchParams = { status: '', triggerType: '', source: '', keyword: '', hasError: false, pagePath: '', clickLabel: '' };
const EMPTY_LIST: ReplaySession[] = [];

const STATUS_META = {
  recording: { label: '录制中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  expired: { label: '已超时', color: 'grey' },
} as const;

const TRIGGER_META: Record<ReplayTriggerType, { label: string; color: string }> = {
  error: { label: '错误触发', color: 'red' },
  sampled: { label: '采样录制', color: 'blue' },
  manual: { label: '手动开启', color: 'purple' },
  rage_click: { label: '暴躁点击', color: 'orange' },
  white_screen: { label: '白屏', color: 'red' },
};

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'recording', label: '录制中' },
  { value: 'completed', label: '已完成' },
  { value: 'expired', label: '已超时' },
];

const triggerOptions = [
  { value: '', label: '全部触发' },
  { value: 'error', label: '错误触发' },
  { value: 'sampled', label: '采样录制' },
  { value: 'manual', label: '手动开启' },
  { value: 'rage_click', label: '暴躁点击' },
  { value: 'white_screen', label: '白屏' },
];

const sourceOptions = [
  { value: '', label: '全部来源' },
  { value: 'web_admin', label: '管理后台' },
  { value: 'web_member', label: '会员前台' },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

export default function SessionReplaysPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: replayKeys.lists });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const listQuery = useReplayList({
    page, pageSize,
    status: submittedParams.status || undefined,
    triggerType: submittedParams.triggerType || undefined,
    source: submittedParams.source || undefined,
    keyword: submittedParams.keyword || undefined,
    hasError: submittedParams.hasError || undefined,
    pagePath: submittedParams.pagePath || undefined,
    clickLabel: submittedParams.clickLabel || undefined,
  });
  const list = listQuery.data?.list ?? EMPTY_LIST;
  const total = listQuery.data?.total ?? 0;

  const detailQuery = useReplayDetail(detailId, detailId !== null);
  const detail = detailQuery.data ?? null;
  const batchDeleteMutation = useBatchDeleteReplays();
  const statsQuery = useReplayStorageStats();
  const stats = statsQuery.data ?? null;

  // ?replay={id} 直达（错误监控跳转）
  useEffect(() => {
    const target = searchParams.get('replay');
    if (target) setDetailId(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 详情开关同步 URL，便于分享定位
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (detailId) next.set('replay', detailId);
      else next.delete('replay');
      return next;
    }, { replace: true });
  }, [detailId, setSearchParams]);

  const columns: ColumnProps<ReplaySession>[] = useMemo(() => [
    {
      title: '触发', width: 110,
      render: (_: unknown, r: ReplaySession) => {
        const primary = r.triggers.find((t) => t.type === 'error') ?? r.triggers[0];
        if (!primary) return <Tag size="small" color="grey">缓冲中</Tag>;
        const meta = TRIGGER_META[primary.type] ?? { label: primary.type, color: 'grey' };
        return <Tag size="small" color={meta.color as 'grey'}>{meta.label}</Tag>;
      },
    },
    {
      title: '入口页面', dataIndex: 'entryPageUrl', width: 260, ellipsis: { showTitle: false },
      render: (v: string | null) => v
        ? <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: '100%' }} size="small">{v.replace(/^https?:\/\/[^/]+/, '')}</Text>
        : '—',
    },
    {
      title: '用户', width: 120,
      render: (_: unknown, r: ReplaySession) => r.username ?? (r.memberId ? `会员#${r.memberId}` : '匿名'),
    },
    {
      title: '时长', dataIndex: 'durationMs', width: 90,
      render: (v: number) => formatDuration(v),
    },
    {
      title: '错误', dataIndex: 'errorCount', width: 70, align: 'right',
      render: (v: number) => v > 0 ? <Text type="danger">{v}</Text> : <Text type="quaternary">0</Text>,
    },
    { title: '翻页', dataIndex: 'pageCount', width: 70, align: 'right' },
    { title: '点击', dataIndex: 'clickCount', width: 70, align: 'right' },
    {
      title: '体积', dataIndex: 'totalBytes', width: 110, align: 'right',
      render: (v: number) => formatBytesMb(v),
    },
    {
      title: '来源', dataIndex: 'source', width: 100,
      render: (v: string) => v === 'web_member' ? '会员前台' : '管理后台',
    },
    {
      title: '浏览器', width: 170,
      render: (_: unknown, r: ReplaySession) => (
        <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: '100%' }} size="small">
          {[r.browser, r.os].filter(Boolean).join(' / ') || '—'}
        </Text>
      ),
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: ReplaySession['status']) => {
        const meta = STATUS_META[v] ?? { label: v, color: 'grey' as const };
        return <Tag size="small" color={meta.color as 'grey'}>{meta.label}</Tag>;
      },
    },
    dateTimeColumn('开始时间', 'startedAt'),
    createOperationColumn<ReplaySession>({
      width: 100,
      desktopInlineKeys: ['play'],
      actions: (record) => [
        { key: 'play', label: '播放', onClick: () => setDetailId(record.id) },
      ],
    }),
  ], []);

  async function handleBatchDelete() {
    const ok = await confirmDelete({ title: `确认删除选中的 ${selectedRowKeys.length} 条回放？`, content: '录像分片将一并删除，不可恢复。' });
    if (!ok) return;
    await batchDeleteMutation.mutateAsync(selectedRowKeys);
    setSelectedRowKeys([]);
  }

  return (
    <div className="page-container">
      {stats && (
        <StatGrid style={{ marginBottom: 16 }}>
          <StatCard title="存储占用" value={formatBytesMb(stats.totalBytes)} sub={stats.quotaMb > 0 ? `配额 ${stats.quotaMb} MB` : '未设配额'} />
          <StatCard
            title="配额使用率"
            value={stats.quotaMb > 0 ? `${stats.usagePercent}%` : '—'}
            accent={stats.usagePercent >= 90 ? 'var(--semi-color-danger)' : stats.usagePercent >= 75 ? 'var(--semi-color-warning)' : undefined}
            sub={stats.usagePercent >= 100 ? '滚动淘汰进行中（旧的无错误回放优先清退）' : stats.usagePercent >= 90 ? '接近配额，即将触发滚动淘汰' : '低于水位线'}
          />
          <StatCard title="今日新增" value={formatBytesMb(stats.todayBytes)} sub={`${stats.todayCount} 个会话`} />
          <StatCard title="回放总数" value={stats.totalCount} sub="按保留天数自动清理" />
        </StatGrid>
      )}
      <SearchToolbar>
        <Select
          placeholder="状态"
          value={draftParams.status || undefined}
          optionList={statusOptions}
          onChange={(value) => setDraftParams((prev) => ({ ...prev, status: (value as string) ?? '' }))}
          style={{ width: 120 }}
        />
        <Select
          placeholder="触发方式"
          value={draftParams.triggerType || undefined}
          optionList={triggerOptions}
          onChange={(value) => setDraftParams((prev) => ({ ...prev, triggerType: (value as string) ?? '' }))}
          style={{ width: 130 }}
        />
        <Select
          placeholder="来源"
          value={draftParams.source || undefined}
          optionList={sourceOptions}
          onChange={(value) => setDraftParams((prev) => ({ ...prev, source: (value as string) ?? '' }))}
          style={{ width: 120 }}
        />
        <KeywordInput
          placeholder="用户名/页面/回放 ID"
          value={draftParams.keyword}
          onChange={(value) => setDraftParams((prev) => ({ ...prev, keyword: value }))}
          onSearch={handleSearch}
          width={200}
        />
        <KeywordInput
          placeholder="访问过的页面路径"
          value={draftParams.pagePath}
          onChange={(value) => setDraftParams((prev) => ({ ...prev, pagePath: value }))}
          onSearch={handleSearch}
          width={170}
        />
        <KeywordInput
          placeholder="点击过的内容"
          value={draftParams.clickLabel}
          onChange={(value) => setDraftParams((prev) => ({ ...prev, clickLabel: value }))}
          onSearch={handleSearch}
          width={150}
        />
        <Checkbox
          checked={draftParams.hasError}
          onChange={(e) => setDraftParams((prev) => ({ ...prev, hasError: Boolean(e.target.checked) }))}
        >
          仅看有错误
        </Checkbox>
        <SearchButton onClick={handleSearch} />
        <ResetButton onClick={handleReset} />
        {selectedRowKeys.length > 0 && (
          <Button type="danger" icon={<Trash2 size={14} />} loading={batchDeleteMutation.isPending} onClick={() => void handleBatchDelete()}>
            批量删除 ({selectedRowKeys.length})
          </Button>
        )}
      </SearchToolbar>

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching && !listQuery.data}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys((keys ?? []) as string[]),
        }}
        size="small"
        empty="暂无回放记录。开启「数据分析设置 → 会话回放」后，报错现场将自动录制。"
        scroll={{ x: 1660 }}
      />

      <SideSheet
        title="会话回放"
        visible={detailId !== null}
        onCancel={() => setDetailId(null)}
        width={Math.min(960, globalThis.innerWidth - 80)}
      >
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
            <Descriptions
              size="small"
              row
              data={[
                { key: '用户', value: detail.username ?? (detail.memberId ? `会员#${detail.memberId}` : '匿名') },
                { key: '时长', value: formatDuration(detail.durationMs) },
                { key: '分片', value: `${detail.segmentCount} 个 · ${formatBytesMb(detail.totalBytes)}` },
                { key: '环境', value: `${detail.browser ?? '?'} / ${detail.os ?? '?'}` },
              ]}
            />
            <Space wrap>
              {detail.triggers.map((t, i) => {
                const meta = TRIGGER_META[t.type] ?? { label: t.type, color: 'grey' };
                return <Tag key={`${t.type}-${i}`} size="small" color={meta.color as 'grey'}>{meta.label} · {t.at.slice(11, 19)}</Tag>;
              })}
            </Space>

            {detail.siblings.length > 0 && (
              <div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>
                  本次浏览器会话共 {detail.siblings.length + 1} 段录像（旅程拼接，点击切换）
                </Text>
                <Space wrap>
                  {[...detail.siblings, { id: detail.id, startedAt: detail.startedAt, durationMs: detail.durationMs, errorCount: detail.errorCount, status: detail.status, entryPageUrl: detail.entryPageUrl }]
                    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
                    .map((seg, i) => (
                      <Tag
                        key={seg.id}
                        size="small"
                        color={seg.id === detail.id ? 'blue' : 'grey'}
                        style={seg.id === detail.id ? undefined : { cursor: 'pointer' }}
                        onClick={seg.id === detail.id ? undefined : () => setDetailId(seg.id)}
                      >
                        片段{i + 1} · {seg.startedAt.slice(11, 19)} · {formatDuration(seg.durationMs)}{seg.errorCount > 0 ? ` · ${seg.errorCount} 错误` : ''}
                      </Tag>
                    ))}
                </Space>
              </div>
            )}

            <ReplayPlayer
              replayId={detail.id}
              segments={detail.segments}
              errors={detail.errors}
              perfEvents={detail.perfEvents}
              startedAt={detail.startedAt}
              live={detail.status === 'recording'}
            />

            {detail.errors.length > 0 && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>关联错误（{detail.errors.length}）</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.errors.map((e) => (
                    <Text
                      key={e.id}
                      type="danger"
                      size="small"
                      ellipsis={{ showTooltip: true }}
                      style={{ maxWidth: '100%', cursor: 'pointer' }}
                      onClick={() => navigate(`/analytics/errors?issue=${e.groupId}`)}
                    >
                      [{e.createdAt.slice(11, 19)}] {e.errorType}: {e.message}
                    </Text>
                  ))}
                </div>
                <Text type="quaternary" size="small">点击错误跳转错误监控 Issue 详情</Text>
              </div>
            )}
            <Text type="tertiary" size="small">
              回放已按隐私策略打码（输入框默认脱敏）；入口页面：{detail.entryPageUrl ?? '—'}
            </Text>
          </div>
        )}
      </SideSheet>
    </div>
  );
}
