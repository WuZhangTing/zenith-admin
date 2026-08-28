import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Banner, Button, Card, Collapse, Empty, Input, SideSheet, Spin, Tag, Timeline, Typography,
} from '@douyinfe/semi-ui';
import { Search } from 'lucide-react';
import type { TraceNodeStatus, TraceTimelineNode } from '@zenith/shared/platform';
import { TRACE_NODE_KIND_LABELS, TRACE_NODE_STATUS_LABELS } from '@zenith/shared/platform';
import { usePermission } from '@/hooks/usePermission';
import { useTraceTimeline } from '@/hooks/queries/trace';
import { useLogFiles, useLogFileContent } from '@/hooks/queries/log-files';

const { Text, Paragraph } = Typography;

type TimelineType = 'default' | 'ongoing' | 'success' | 'error';

const STATUS_META: Record<TraceNodeStatus, { color: 'green' | 'red' | 'blue' | 'grey'; timeline: TimelineType }> = {
  success: { color: 'green', timeline: 'success' },
  failed: { color: 'red', timeline: 'error' },
  running: { color: 'blue', timeline: 'ongoing' },
  pending: { color: 'grey', timeline: 'default' },
};

const KIND_COLORS = {
  request: 'blue',
  job: 'violet',
  event: 'cyan',
  notification: 'orange',
  task: 'light-blue',
} as const satisfies Record<TraceTimelineNode['kind'], string>;

const TRACE_ID_RE = /^[\w-]{8,64}$/;

/** 链路日志（复用日志文件接口按 traceId 全文过滤，默认查最新的应用日志文件） */
function TraceLogsPanel({ traceId }: { traceId: string }) {
  const filesQuery = useLogFiles();
  // pino-roll 按天滚动：取最新未压缩的 app 日志文件
  const latestFile = useMemo(() => {
    const files = filesQuery.data ?? [];
    return files
      .filter((f) => f.name.startsWith('app.') && !f.isGzip)
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))[0]?.name;
  }, [filesQuery.data]);
  const contentQuery = useLogFileContent(latestFile, { lines: 5000, keyword: traceId }, Boolean(latestFile));
  const lines = contentQuery.data?.lines ?? [];

  return (
    <Spin spinning={filesQuery.isPending || contentQuery.isFetching}>
      {lines.length === 0 ? (
        <Empty description="当天日志中未检索到该链路的记录" style={{ padding: '16px 0' }} />
      ) : (
        <div style={{
          fontFamily: 'var(--zx-font-mono, monospace)', fontSize: 12, lineHeight: '20px',
          maxHeight: 360, overflow: 'auto', background: 'var(--semi-color-fill-0)',
          borderRadius: 'var(--semi-border-radius-medium)', padding: '8px 12px', wordBreak: 'break-all',
        }}>
          {lines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
      {latestFile && (
        <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
          检索范围：{latestFile} 最近 5000 行（跨天日志请到「日志文件」页按关键字查询）
        </Text>
      )}
    </Spin>
  );
}

export default function TracePage() {
  const { hasPermission } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const traceId = searchParams.get('traceId');
  const [draft, setDraft] = useState(traceId ?? '');
  const [detailNode, setDetailNode] = useState<TraceTimelineNode | null>(null);

  const timelineQuery = useTraceTimeline(traceId);
  const nodes = useMemo(() => timelineQuery.data?.nodes ?? [], [timelineQuery.data]);

  function handleSearch() {
    const next = draft.trim();
    if (!next || !TRACE_ID_RE.test(next)) return;
    setSearchParams(next === traceId ? searchParams : { traceId: next });
  }

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
    return counts;
  }, [nodes]);

  return (
    <div className="page-container zx-flat-panels">
      <Banner
        fullMode={false} type="info" closeIcon={null} style={{ marginBottom: 12 }}
        description="输入链路 ID（接口响应头 X-Request-Id / 报错提示中的链路ID / 操作日志详情），查看一次操作触发的请求、作业、事件、通知与任务的完整时间线。"
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 560 }}>
        <Input
          prefix={<Search size={14} />}
          placeholder="链路 ID，如 b9c67477-1433-4815-bbf3-51419c322770"
          value={draft}
          onChange={setDraft}
          onEnterPress={handleSearch}
          showClear
        />
        <Button theme="solid" onClick={handleSearch} disabled={!TRACE_ID_RE.test(draft.trim())}>查询</Button>
      </div>

      {!traceId ? (
        <Empty title="输入链路 ID 开始追踪" description="从操作日志详情、任务中心或报错提示中获取链路 ID" style={{ padding: '48px 0' }} />
      ) : (
        <Spin spinning={timelineQuery.isFetching}>
          {timelineQuery.isFetched && nodes.length === 0 ? (
            <Empty title="未找到该链路的留痕" description="链路 ID 可能有误，或相关数据已按保留策略清理" style={{ padding: '48px 0' }} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
                <Text type="tertiary" size="small">共 {nodes.length} 个节点：</Text>
                {[...kindCounts.entries()].map(([kind, count]) => (
                  <Tag key={kind} size="small" color={KIND_COLORS[kind as TraceTimelineNode['kind']]}>
                    {TRACE_NODE_KIND_LABELS[kind as TraceTimelineNode['kind']]} × {count}
                  </Tag>
                ))}
              </div>

              <Timeline mode="left">
                {nodes.map((node, i) => (
                  <Timeline.Item
                    key={`${node.kind}-${node.refId}-${i}`}
                    time={node.ts}
                    type={STATUS_META[node.status].timeline}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Tag size="small" color={KIND_COLORS[node.kind]}>{TRACE_NODE_KIND_LABELS[node.kind]}</Tag>
                      <Text strong>{node.title}</Text>
                      <Tag size="small" color={STATUS_META[node.status].color}>{TRACE_NODE_STATUS_LABELS[node.status]}</Tag>
                      {node.durationMs !== null && <Text type="tertiary" size="small">{node.durationMs}ms</Text>}
                      <Button size="small" theme="borderless" type="primary" onClick={() => setDetailNode(node)}>详情</Button>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>

              {hasPermission('system:log:files') && (
                <Collapse style={{ marginTop: 16 }}>
                  <Collapse.Panel header="应用日志（按链路 ID 过滤）" itemKey="logs">
                    <TraceLogsPanel traceId={traceId} />
                  </Collapse.Panel>
                </Collapse>
              )}
            </>
          )}
        </Spin>
      )}

      {/* 节点明细抽屉 */}
      <SideSheet
        title={detailNode ? `${TRACE_NODE_KIND_LABELS[detailNode.kind]} · ${detailNode.title}` : ''}
        visible={detailNode !== null}
        onCancel={() => setDetailNode(null)}
        width={560}
        closeOnEsc
      >
        {detailNode && (
          <div className="zx-flat-panels">
            <Card title="节点信息">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Text>时间：{detailNode.ts}</Text>
                <Text>状态：<Tag size="small" color={STATUS_META[detailNode.status].color}>{TRACE_NODE_STATUS_LABELS[detailNode.status]}</Tag></Text>
                {detailNode.durationMs !== null && <Text>耗时：{detailNode.durationMs}ms</Text>}
                <Text>单据 ID：{detailNode.refId}</Text>
              </div>
            </Card>
            <Card title="明细" style={{ marginTop: 12 }}>
              <Paragraph>
                <pre style={{
                  margin: 0, fontSize: 12, lineHeight: '20px', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all', maxHeight: 480, overflow: 'auto',
                }}>
                  {JSON.stringify(detailNode.detail, null, 2)}
                </pre>
              </Paragraph>
            </Card>
          </div>
        )}
      </SideSheet>
    </div>
  );
}
