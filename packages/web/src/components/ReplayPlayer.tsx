/**
 * 会话回放播放器：rrweb-player 惰性加载（独立 chunk），
 * 拉取全部分片拼接事件后一次性初始化（错误触发的回放通常 1-10 个分片）。
 * 三期实时追流场景改用增量 addEvent 数据源，本组件接口保持不变。
 */
import { useEffect, useRef, useState } from 'react';
import { Empty, Spin, Typography } from '@douyinfe/semi-ui';
import type { ReplaySegmentMeta } from '@zenith/shared/analytics';
import { fetchReplaySegmentEvents } from '@/hooks/queries/session-replays';

const { Text } = Typography;

interface ReplayPlayerProps {
  replayId: string;
  segments: ReplaySegmentMeta[];
  /** 播放器宽度（px），默认自适应容器 */
  width?: number;
}

interface RrwebPlayerInstance {
  $destroy?: () => void;
  pause?: () => void;
}

export default function ReplayPlayer({ replayId, segments, width }: Readonly<ReplayPlayerProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RrwebPlayerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [{ default: Player }] = await Promise.all([
          import('rrweb-player'),
          import('rrweb-player/dist/style.css'),
        ]);
        // 分片按 seq 有序拼接为完整事件流
        const chunks = await Promise.all(segments.map((seg) => fetchReplaySegmentEvents(replayId, seg.seq)));
        if (cancelled) return;
        const events = chunks.flat();
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
          : <div ref={containerRef} className="zx-replay-player" style={{ display: 'flex', justifyContent: 'center' }} />}
      </div>
    </Spin>
  );
}
