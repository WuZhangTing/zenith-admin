import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Spin, Typography } from '@douyinfe/semi-ui';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { IotDevice } from '@zenith/shared/iot';
import { StatCard, StatGrid } from '@/components/charts';
import { useIotDeviceList } from '@/hooks/queries/iot-devices';
import IotDeviceDetailDrawer from './IotDeviceDetailDrawer';

const { Text } = Typography;

/** OSM 栅格底图（与文件预览的地理渲染器同源；生产可替换为自托管瓦片） */
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: [OSM_TILE_URL],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

/** 设备地图：有经纬度的设备散点（在线绿 / 离线灰），点击进详情 */
export default function IotMapPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [detailDevice, setDetailDevice] = useState<IotDevice | null>(null);
  const detailRef = useRef(setDetailDevice);
  detailRef.current = setDetailDevice;

  // 位置设备清单（上限 100 台/页，取第一页；更大规模建议先按产品/分组筛选）
  const listQuery = useIotDeviceList({ page: 1, pageSize: 100 });
  const devices = useMemo(
    () => (listQuery.data?.list ?? []).filter((d) => d.latitude != null && d.longitude != null),
    [listQuery.data],
  );
  const onlineCount = devices.filter((d) => d.online).length;

  // 初始化地图（maplibre 动态引入，独立 chunk）
  useEffect(() => {
    let disposed = false;
    void import('maplibre-gl').then(({ Map: MapCtor, NavigationControl }) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const map = new MapCtor({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [104.5, 35.5],
        zoom: 3.2,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => setMapReady(true));
      mapRef.current = map;
    });
    return () => {
      disposed = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // 设备散点：数据变化时重建 markers 并自适应视野
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    void import('maplibre-gl').then(({ Marker, LngLatBounds, Popup }) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = devices.map((device) => {
        const el = document.createElement('div');
        el.style.cssText = [
          'width:14px', 'height:14px', 'border-radius:50%', 'cursor:pointer',
          'border:2px solid var(--semi-color-bg-0, #fff)',
          `background:${device.online ? 'var(--semi-color-success, #3bb346)' : 'var(--semi-color-text-3, #aaa)'}`,
          'box-shadow:0 1px 4px rgba(0,0,0,.35)',
        ].join(';');
        el.title = `${device.name}（${device.sn}）`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          detailRef.current(device);
        });
        const marker = new Marker({ element: el })
          .setLngLat([device.longitude!, device.latitude!])
          .setPopup(new Popup({ offset: 12, closeButton: false }).setHTML(
            `<div style="font-size:12px"><b>${device.name}</b><br/>${device.sn}<br/>${device.online ? '🟢 在线' : '⚪ 离线'}${device.address ? `<br/>${device.address}` : ''}</div>`,
          ))
          .addTo(map);
        el.addEventListener('mouseenter', () => marker.togglePopup());
        el.addEventListener('mouseleave', () => marker.togglePopup());
        return marker;
      });
      if (devices.length > 0) {
        const bounds = devices.reduce(
          (b, d) => b.extend([d.longitude!, d.latitude!]),
          new LngLatBounds([devices[0].longitude!, devices[0].latitude!], [devices[0].longitude!, devices[0].latitude!]),
        );
        map.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 400 });
      }
    });
  }, [devices, mapReady]);

  return (
    <div className="page-container">
      <StatGrid style={{ marginBottom: 12 }}>
        <StatCard title="已定位设备" value={`${devices.length} 台`} />
        <StatCard title="在线" value={`${onlineCount} 台`} accent="var(--semi-color-success)" />
        <StatCard title="离线" value={`${devices.length - onlineCount} 台`} />
      </StatGrid>
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          style={{
            width: '100%', height: 'calc(100vh - 280px)', minHeight: 420,
            borderRadius: 'var(--semi-border-radius-medium)',
            border: '1px solid var(--semi-color-border)',
            overflow: 'hidden',
          }}
        />
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin size="large" />
          </div>
        )}
        {mapReady && !listQuery.isLoading && devices.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--semi-color-bg-0) 72%, transparent)', pointerEvents: 'none',
          }}>
            <Empty description={(
              <Text type="tertiary">暂无已定位设备 — 在设备「编辑」表单中填写经纬度后显示在地图上</Text>
            )} />
          </div>
        )}
      </div>

      <IotDeviceDetailDrawer device={detailDevice} onClose={() => setDetailDevice(null)} />
    </div>
  );
}
