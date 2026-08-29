/**
 * 页面点击热力 Tab：从回放录像聚合的真实点击坐标（视口归一化 2% 网格），
 * 选页面路径后以密度渐变渲染热点，无需页面截图底图。
 */
import { useMemo, useState } from 'react';
import { Empty, Select, Spin, Typography } from '@douyinfe/semi-ui';
import { useClickHeatmap, useHeatmapPages } from '@/hooks/queries/session-replays';

const { Text } = Typography;

const DAYS_OPTIONS = [
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
  { value: 90, label: '近 90 天' },
];

export default function ReplayHeatmapTab() {
  const [pagePath, setPagePath] = useState('');
  const [days, setDays] = useState(30);

  const pagesQuery = useHeatmapPages(days);
  const pages = pagesQuery.data ?? [];
  const heatmapQuery = useClickHeatmap(pagePath, days);
  const heatmap = heatmapQuery.data ?? null;

  const maxCount = useMemo(
    () => Math.max(1, ...(heatmap?.points.map((p) => p.count) ?? [1])),
    [heatmap],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Select
          placeholder="选择页面路径"
          value={pagePath || undefined}
          optionList={pages.map((p) => ({ value: p, label: p }))}
          onChange={(v) => setPagePath((v as string) ?? '')}
          style={{ width: 320 }}
          filter
          loading={pagesQuery.isFetching}
        />
        <Select
          value={days}
          optionList={DAYS_OPTIONS}
          onChange={(v) => setDays(v as number)}
          style={{ width: 110 }}
        />
        {heatmap && <Text type="tertiary" size="small">共 {heatmap.total} 次点击 · {heatmap.points.length} 个热点网格</Text>}
      </div>

      {!pagePath ? (
        <Empty
          title="选择页面查看点击热力"
          description="热力数据来自回放录像的真实点击坐标（视口相对位置，随回放采集持续累积）"
          style={{ padding: '48px 0' }}
        />
      ) : (
        <Spin spinning={heatmapQuery.isFetching}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 960,
              aspectRatio: '16 / 10',
              border: '1px solid var(--semi-color-border)',
              borderRadius: 'var(--semi-border-radius-medium)',
              background:
                'linear-gradient(var(--semi-color-fill-0) 1px, transparent 1px), linear-gradient(90deg, var(--semi-color-fill-0) 1px, transparent 1px)',
              backgroundSize: '10% 10%',
              overflow: 'hidden',
            }}
            aria-label={`${pagePath} 的点击热力图`}
          >
            {heatmap?.points.map((p) => {
              const intensity = p.count / maxCount;
              const size = 18 + intensity * 42;
              return (
                <span
                  key={`${p.x}-${p.y}`}
                  title={`(${p.x}%, ${p.y}%) ${p.count} 次点击`}
                  style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: size,
                    height: size,
                    marginLeft: -size / 2,
                    marginTop: -size / 2,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(255,77,79,${0.25 + intensity * 0.55}) 0%, rgba(255,150,50,${0.12 + intensity * 0.25}) 55%, transparent 75%)`,
                    pointerEvents: 'auto',
                  }}
                />
              );
            })}
            {heatmap && heatmap.points.length === 0 && !heatmapQuery.isFetching && (
              <Text type="quaternary" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                该页面暂无点击数据
              </Text>
            )}
          </div>
          <Text type="quaternary" size="small" style={{ display: 'block', marginTop: 8 }}>
            坐标为视口相对位置的近似还原（不含滚动偏移），画布按 16:10 视口比例示意；悬浮热点查看点击次数
          </Text>
        </Spin>
      )}
    </div>
  );
}
