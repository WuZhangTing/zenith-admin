/**
 * 会话回放播放器：rrweb-player 惰性加载（独立 chunk）。
 *
 * 三种能力：
 * - 回放：拉取全部分片拼接事件流一次性初始化；
 * - 时间轴标注：错误（红）/ 页面跳转（蓝）/ 行为信号（橙）打点，点击 seek；
 * - 实时旁观（live）：recording 会话以 liveMode 初始化，新分片增量 addEvent 追流；
 * - 点击热点：本次会话点击坐标叠加半透明热点层（近似视口位置）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Spin, Switch, Tag, Tooltip, Typography } from '@douyinfe/semi-ui';
import type { ReplaySegmentMeta, ReplaySessionDetail } from '@zenith/shared/analytics';
import { fetchReplaySegmentEvents } from '@/hooks/queries/session-replays';

const { Text } = Typography;

const EVENT_INCREMENTAL = 3;
const EVENT_META = 4;
const EVENT_CUSTOM = 5;
const INCREMENTAL_SOURCE_MOUSE_INTERACTION = 2;
const MOUSE_INTERACTION_CLICK = 2;

interface RrwebEventLite {
  type: number;
  timestamp: number;
  data?: { tag?: string; payload?: unknown; source?: number; type?: number; x?: number; y?: number; width?: number; height?: number };
}

interface RrwebPlayerInstance {
  $destroy?: () => void;
  pause?: () => void;
  goto?: (offsetMs: number, play?: boolean) => void;
  addEvent?: (event: unknown) => void;
}

export interface ReplayMarker {
  /** 相对回放起点的偏移（ms） */
  offsetMs: number;
  kind: 'error' | 'navigation' | 'signal';
  label: string;
}

interface ClickPoint { xPct: number; yPct: number }

interface ReplayPlayerProps {
  replayId: string;
  segments: ReplaySegmentMeta[];
  /** 关联错误（服务端时钟，转偏移标注） */
  errors?: ReplaySessionDetail['errors'];
  /** 回放起点（formatDateTime 字符串，错误偏移计算基准） */
  startedAt?: string;
  /** 实时旁观：recording 会话追流（调用方轮询详情刷新 segments） */
  live?: boolean;
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

/** 提取点击坐标并按录制视口归一化为百分比（近似视口位置） */
function extractClickPoints(events: RrwebEventLite[]): ClickPoint[] {
  const points: ClickPoint[] = [];
  let viewportW = 0;
  let viewportH = 0;
  for (const e of events) {
    if (e.type === EVENT_META && e.data?.width && e.data?.height) {
      viewportW = e.data.width;
      viewportH = e.data.height;
    } else if (
      e.type === EVENT_INCREMENTAL
      && e.data?.source === INCREMENTAL_SOURCE_MOUSE_INTERACTION
      && e.data?.type === MOUSE_INTERACTION_CLICK
      && viewportW > 0 && viewportH > 0
      && typeof e.data.x === 'number' && typeof e.data.y === 'number'
    ) {
      points.push({
        xPct: Math.min(100, Math.max(0, (e.data.x / viewportW) * 100)),
        yPct: Math.min(100, Math.max(0, (e.data.y / viewportH) * 100)),
      });
    }
  }
  return points;
}

function formatOffset(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ReplayPlayer({ replayId, segments, errors, startedAt, live = false, width }: Readonly<ReplayPlayerProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);
  /** 已加载的最大 seq（live 增量追流游标） */
  const loadedSeqRef = useRef(-1);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ baseTs: number; durationMs: number; markers: ReplayMarker[] } | null>(null);
  const [clickPoints, setClickPoints] = useState<ClickPoint[]>([]);
  const [showHeat, setShowHeat] = useState(false);

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

  // 初始化：加载当前全部分片并创建播放器（live 模式 liveMode 初始化）
  useEffect(() => {
    let cancelled = false;
    loadedSeqRef.current = -1;

    async function init() {
      setLoading(true);
      setError(null);
      setTimeline(null);
      setClickPoints([]);
      try {
        const [{ default: Player }] = await Promise.all([
          import('rrweb-player'),
          import('rrweb-player/dist/style.css'),
        ]);
        const initialSegments = segmentsRef.current;
        const chunks = await Promise.all(initialSegments.map((seg) => fetchReplaySegmentEvents(replayId, seg.seq)));
        if (cancelled) return;
        const events = chunks.flat() as RrwebEventLite[];
        if (events.length < 2 && !live) {
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
            autoPlay: live,
            showController: !live,
            skipInactive: !live,
            liveMode: live,
          },
        }) as unknown as RrwebPlayerInstance;
        loadedSeqRef.current = initialSegments.length > 0 ? Math.max(...initialSegments.map((s) => s.seq)) : -1;
        if (events.length >= 2) {
          const baseTs = events[0].timestamp;
          setTimeline({
            baseTs,
            durationMs: Math.max(1, events[events.length - 1].timestamp - baseTs),
            markers: extractMarkers(events, baseTs),
          });
          setClickPoints(extractClickPoints(events));
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('回放加载失败');
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
      try {
        playerRef.current?.pause?.();
        playerRef.current?.$destroy?.();
      } catch { /* ignore */ }
      playerRef.current = null;
    };
    // segments 增量由下方 live effect 处理，避免轮询刷新导致播放器整体重建
  }, [replayId, live, width]);

  // live 追流：segments 更新时增量拉取新 seq 分片 addEvent
  useEffect(() => {
    if (!live || !playerRef.current?.addEvent) return;
    const fresh = segments.filter((s) => s.seq > loadedSeqRef.current);
    if (fresh.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const seg of fresh.toSorted((a, b) => a.seq - b.seq)) {
        const events = await fetchReplaySegmentEvents(replayId, seg.seq);
        if (cancelled) return;
        for (const e of events) playerRef.current?.addEvent?.(e);
        loadedSeqRef.current = Math.max(loadedSeqRef.current, seg.seq);
      }
    })();
    return () => { cancelled = true; };
  }, [live, segments, replayId]);

  if (segments.length === 0 && !live) {
    return <Empty title="暂无回放数据" description="该会话还没有已上传的录制分片" style={{ padding: '32px 0' }} />;
  }

  return (
    <Spin spinning={loading} tip={live ? '接入实时画面…' : '回放加载中…'}>
      <div style={{ minHeight: 320 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          {live && (
            <Tag color="red" size="small">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentcolor', animation: 'zx-live-pulse 1.2s infinite' }} />
                实时旁观
              </span>
            </Tag>
          )}
          {!live && clickPoints.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <Text type="tertiary" size="small">点击热点（{clickPoints.length}）</Text>
              <Switch size="small" checked={showHeat} onChange={setShowHeat} aria-label="切换点击热点显示" />
            </span>
          )}
        </div>
        {error
          ? <Text type="danger">{error}</Text>
          : (
            <>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <div ref={containerRef} className="zx-replay-player" />
                {showHeat && !live && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
                    {clickPoints.map((p, i) => (
                      <span
                        key={`${p.xPct}-${p.yPct}-${i}`}
                        style={{
                          position: 'absolute',
                          left: `${p.xPct}%`,
                          top: `${p.yPct}%`,
                          width: 22,
                          height: 22,
                          marginLeft: -11,
                          marginTop: -11,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(255,77,79,0.55) 0%, rgba(255,77,79,0.18) 55%, transparent 75%)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {showHeat && !live && (
                <Text type="quaternary" size="small" style={{ display: 'block', marginTop: 4 }}>
                  热点为视口相对位置的近似还原，页面滚动时可能存在偏移
                </Text>
              )}
              {timeline && allMarkers.length > 0 && !live && (
                <div style={{ margin: '12px 4px 0' }}>
                  <div
                    style={{
                      position: 'relative', height: 18, borderRadius: 'var(--semi-border-radius-small)',
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
