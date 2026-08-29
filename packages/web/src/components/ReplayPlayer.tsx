/**
 * 会话回放播放器：rrweb-player 惰性加载（独立 chunk），
 * 拉取全部分片拼接事件后一次性初始化（错误触发的回放通常 1-10 个分片）。
 *
 * 时间轴标注：错误（红）/ 页面跳转（蓝）/ 暴躁点击等自定义信号（橙）
 * 渲染在播放器下方的标注条上，点击打点 seek 到对应时刻。
 * 三期实时追流场景改用增量 addEvent 数据源，本组件接口保持不变。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Spin, Tooltip, Typography } from '@douyinfe/semi-ui';
import type { ReplaySegmentMeta, ReplaySessionDetail } from '@zenith/shared/analytics';
import { fetchReplaySegmentEvents } from '@/hooks/queries/session-replays';

const { Text } = Typography;

const EVENT_CUSTOM = 5;

interface RrwebEventLite { type: number; timestamp: number; data?: { tag?: string; payload?: unknown } }

interface RrwebPlayerInstance {
  $destroy?: () => void;
  pause?: () => void;
  goto?: (offsetMs: number, play?: boolean) => void;
}

export interface ReplayMarker {
  /** 相对回放起点的偏移（ms） */
  offsetMs: number;
  kind: 'error' | 'navigation' | 'signal';
  label: string;
}

interface ReplayPlayerProps {
  replayId: string;
  segments: ReplaySegmentMeta[];
  /** 关联错误（服务端时钟，转偏移标注） */
  errors?: ReplaySessionDetail['errors'];
  /** 回放起点（formatDateTime 字符串，错误偏移计算基准） */
  startedAt?: string;
  /** 播放器宽度（px），默认自适应容器 */
  width?: number;
}

const MARKER_STYLE: Record<ReplayMarker['kind'], { color: string; label: string }> = {
  error: { color: 'var(--semi-color-danger)', label: '错误' },
  navigation: { color: 'var(--semi-color-primary)', label: '页面跳转' },
  signal: { color: 'var(--semi-color-warning)', label: '行为信号' },
};

/** 从 rrweb 事件流提取时间轴打点（自定义面包屑事件） */
function extractMarkers(events: RrwebEventLite[], baseTs: number): ReplayMarker[] {
  const markers: ReplayMarker[] = [];
  for (const e of events) {
    if (e.type !== EVENT_CUSTOM || e.data?.tag !== 'breadcrumb') continue;
    const crumb = e.data.payload as { type?: string; message?: string } | undefined;
    if (!crumb?.type) continue;
    const offsetMs = Math.max(0, e.timestamp - baseTs);
    if (crumb.type === 'navigation') {
      markers.push({ offsetMs, kind: 'navigation', label: crumb.message ?? '页面跳转' });
    } else if (crumb.type === 'custom') {
      markers.push({ offsetMs, kind: 'signal', label: crumb.message ?? '行为信号' });
    }
  }
  return markers;
}

function formatOffset(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ReplayPlayer({ replayId, segments, errors, startedAt, width }: Readonly<ReplayPlayerProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ baseTs: number; durationMs: number; markers: ReplayMarker[] } | null>(null);

  const errorMarkers = useMemo<ReplayMarker[]>(() => {
    if (!errors?.length || !startedAt || !timeline) return [];
    const base = new Date(startedAt.replace(' ', 'T')).getTime();
    if (!Number.isFinite(base)) return [];
    const markers: ReplayMarker[] = [];
    for (const e of errors) {
      const at = new Date(e.createdAt.replace(' ', 'T')).getTime();
      if (!Number.isFinite(at)) continue;
      markers.push({
        offsetMs: Math.min(Math.max(0, at - base), timeline.durationMs),
        kind: 'error',
        label: `${e.errorType}: ${e.message.slice(0, 120)}`,
      });
    }
    return markers;
  }, [errors, startedAt, timeline]);

  const allMarkers = useMemo(
    () => [...(timeline?.markers ?? []), ...errorMarkers].sort((a, b) => a.offsetMs - b.offsetMs),
    [timeline, errorMarkers],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setTimeline(null);
      try {
        const [{ default: Player }] = await Promise.all([
          import('rrweb-player'),
          import('rrweb-player/dist/style.css'),
        ]);
        // 分片按 seq 有序拼接为完整事件流
        const chunks = await Promise.all(segments.map((seg) => fetchReplaySegmentEvents(replayId, seg.seq)));
        if (cancelled) return;
        const events = chunks.flat() as RrwebEventLite[];
        if (events.length < 2) {
          setError('回放事件不足，无法播放');
          setLoading(false);
          return;
        }
        const host = containerRef.current;
        if (!host) return;
        host.innerHTML = '';
        const w = width ?? Math.max(480, host.clientWidth - 16);
        playerRef.current = new Player({
          target: host,
          props: {
            events: events as never[],
            width: w,
            height: Math.round(w * 0.62),
            autoPlay: false,
            showController: true,
            skipInactive: true,
          },
        }) as unknown as RrwebPlayerInstance;
        const baseTs = events[0].timestamp;
        setTimeline({
          baseTs,
          durationMs: Math.max(1, events[events.length - 1].timestamp - baseTs),
          markers: extractMarkers(events, baseTs),
        });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('回放加载失败');
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      try {
        playerRef.current?.pause?.();
        playerRef.current?.$destroy?.();
      } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [replayId, segments, width]);

  if (segments.length === 0) {
    return <Empty title="暂无回放数据" description="该会话还没有已上传的录制分片" style={{ padding: '32px 0' }} />;
  }

  return (
    <Spin spinning={loading} tip="回放加载中…">
      <div style={{ minHeight: 320 }}>
        {error
          ? <Text type="danger">{error}</Text>
          : (
            <>
              <div ref={containerRef} className="zx-replay-player" style={{ display: 'flex', justifyContent: 'center' }} />
              {timeline && allMarkers.length > 0 && (
                <div style={{ margin: '12px 4px 0' }}>
                  <div
                    style={{
                      position: 'relative', height: 18, borderRadius: 4,
                      background: 'var(--semi-color-fill-0)',
                    }}
                    aria-label="回放事件标注条"
                  >
                    {allMarkers.map((m, i) => (
                      <Tooltip key={`${m.kind}-${m.offsetMs}-${i}`} content={`[${formatOffset(m.offsetMs)}] ${MARKER_STYLE[m.kind].label} · ${m.label}`}>
                        <button
                          type="button"
                          onClick={() => playerRef.current?.goto?.(m.offsetMs, false)}
                          style={{
                            position: 'absolute',
                            left: `${Math.min(99, (m.offsetMs / timeline.durationMs) * 100).toFixed(2)}%`,
                            top: m.kind === 'error' ? 2 : 5,
                            width: m.kind === 'error' ? 14 : 8,
                            height: m.kind === 'error' ? 14 : 8,
                            borderRadius: '50%',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            background: MARKER_STYLE[m.kind].color,
                          }}
                          aria-label={`跳转到 ${formatOffset(m.offsetMs)} 的${MARKER_STYLE[m.kind].label}`}
                        />
                      </Tooltip>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    {(['error', 'navigation', 'signal'] as const).map((kind) => (
                      allMarkers.some((m) => m.kind === kind) && (
                        <Text key={kind} type="tertiary" size="small">
                          <span style={{
                            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                            background: MARKER_STYLE[kind].color, marginRight: 4,
                          }} />
                          {MARKER_STYLE[kind].label}
                        </Text>
                      )
                    ))}
                    <Text type="quaternary" size="small">点击打点跳转到对应时刻</Text>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </Spin>
  );
}
