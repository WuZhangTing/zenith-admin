import { useMemo, useState } from 'react';
import {
  Banner, Button, Card, Descriptions, Empty, Form, Popconfirm, Radio, RadioGroup,
  SideSheet, Spin, Table, Tag, Toast, Typography,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import { AreaChart, EmptyChart, chartOptions, isEmptyValues, makeAreaSpec, useChartPalette } from '@/components/charts';
import { usePermission } from '@/hooks/usePermission';
import { EMPTY_PLACEHOLDER } from '@/utils/table-columns';
import {
  useIotCommands, useIotTelemetry, useResetIotDeviceSecret, useSendIotCommand,
} from '@/hooks/queries/iot-devices';
import { IOT_COMMAND_STATUS_LABELS } from '@zenith/shared/iot';
import type { IotCommand, IotDevice } from '@zenith/shared/iot';

const { Text } = Typography;

const COMMAND_STATUS_COLORS = {
  pending: 'grey',
  delivered: 'blue',
  acked: 'green',
  failed: 'red',
  expired: 'orange',
} as const satisfies Record<IotCommand['status'], string>;

interface IotDeviceDetailDrawerProps {
  device: IotDevice | null;
  onClose: () => void;
}

/** 设备详情抽屉：接入凭证 / 遥测曲线 / 指令下发与记录 */
export default function IotDeviceDetailDrawer({ device, onClose }: IotDeviceDetailDrawerProps) {
  const { hasPermission } = usePermission();
  const palette = useChartPalette();
  const [days, setDays] = useState(1);
  const [metricKey, setMetricKey] = useState<string | null>(null);
  const [commandPage, setCommandPage] = useState(1);
  const [formApi, setFormApi] = useState<FormApi | null>(null);

  const deviceId = device?.id ?? null;
  const telemetryQuery = useIotTelemetry(hasPermission('iot:telemetry:view') ? deviceId : null, days);
  const commandsQuery = useIotCommands(hasPermission('iot:command:send') ? deviceId : null, { page: commandPage, pageSize: 5 });
  const resetSecretMutation = useResetIotDeviceSecret();
  const sendCommandMutation = useSendIotCommand();

  const points = useMemo(() => telemetryQuery.data ?? [], [telemetryQuery.data]);

  // 可绘制指标 = 产品声明的关键指标 ∪ 数据中出现过的数值型指标
  const metricKeys = useMemo(() => {
    const keys = new Set<string>(device?.keyMetrics ?? []);
    for (const p of points) {
      for (const [k, v] of Object.entries(p.metrics)) {
        if (typeof v === 'number') keys.add(k);
      }
    }
    return [...keys];
  }, [device?.keyMetrics, points]);

  const activeMetric = metricKey && metricKeys.includes(metricKey) ? metricKey : (metricKeys[0] ?? null);

  const chartData = useMemo(() => {
    if (!activeMetric) return [];
    return points
      .filter((p) => typeof p.metrics[activeMetric] === 'number')
      .map((p) => ({ time: p.reportedAt, value: p.metrics[activeMetric] as number }));
  }, [points, activeMetric]);

  const chartSpec = useMemo(() => makeAreaSpec({
    data: chartData,
    xField: 'time',
    series: [{ field: 'value', name: activeMetric ?? '指标', color: palette.primary }],
    palette,
    fillOpacity: 0.16,
    axis: { xLabel: (value) => String(value).slice(5, 16) },
    tooltip: { title: (value) => `时间：${value}` },
  }), [chartData, activeMetric, palette]);

  function handleResetSecret() {
    if (!device) return;
    resetSecretMutation.mutate(device.id, {
      onSuccess: () => Toast.success('密钥已重置，请同步更新设备侧配置'),
    });
  }

  async function handleSendCommand() {
    if (!formApi || !device) return;
    const values = await formApi.validate();
    let params: Record<string, unknown> | null = null;
    const paramsText = (values.params as string | undefined)?.trim();
    if (paramsText) {
      try {
        params = JSON.parse(paramsText) as Record<string, unknown>;
      } catch {
        Toast.error('参数不是合法 JSON');
        return;
      }
    }
    sendCommandMutation.mutate(
      {
        deviceId: device.id,
        values: {
          service: values.service as string,
          params,
          ttlSeconds: typeof values.ttlSeconds === 'number' ? values.ttlSeconds : undefined,
        },
      },
      {
        onSuccess: (saved) => {
          Toast.success(saved.status === 'delivered' ? '指令已实时送达设备' : '设备离线，指令将在上线后送达');
          formApi.reset();
          setCommandPage(1);
        },
      },
    );
  }

  const commandColumns: ColumnProps<IotCommand>[] = [
    { title: '指令', dataIndex: 'service', width: 130, render: (v: string) => <Text code>{v}</Text> },
    {
      title: '参数', dataIndex: 'params', width: 150,
      render: (v: IotCommand['params']) => v
        ? <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 140 }} size="small">{JSON.stringify(v)}</Text>
        : EMPTY_PLACEHOLDER,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: IotCommand['status'], r: IotCommand) => (
        <Tag color={COMMAND_STATUS_COLORS[v]} size="small">
          {IOT_COMMAND_STATUS_LABELS[v]}{v === 'failed' && r.errorMsg ? ` · ${r.errorMsg}` : ''}
        </Tag>
      ),
    },
    { title: '下发时间', dataIndex: 'createdAt', width: 150 },
    {
      title: '回执时间', dataIndex: 'ackedAt', width: 150,
      render: (v: string | null) => v ?? EMPTY_PLACEHOLDER,
    },
  ];

  return (
    <SideSheet
      title={device ? `设备详情 · ${device.name}` : '设备详情'}
      visible={device !== null}
      onCancel={onClose}
      width={760}
      closeOnEsc
    >
      {/* 抽屉走 portal 渲染，内容层自带 zx-flat-panels 维持统计区无卡片语言 */}
      <div className="zx-flat-panels">
        {device && (
          <>
            <Card title="接入凭证">
              <Descriptions
                align="left"
                data={[
                  { key: '设备 SN', value: <Text copyable>{device.sn}</Text> },
                  {
                    key: '接入密钥',
                    value: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Text copyable={{ content: device.secret }}>{`${device.secret.slice(0, 8)}••••${device.secret.slice(-4)}`}</Text>
                        {hasPermission('iot:device:update') && (
                          <Popconfirm
                            title="确认重置密钥？"
                            content="旧密钥立即失效，设备需换用新密钥重新接入"
                            onConfirm={handleResetSecret}
                          >
                            <Button size="small" loading={resetSecretMutation.isPending}>重置</Button>
                          </Popconfirm>
                        )}
                      </span>
                    ),
                  },
                  { key: '所属产品', value: device.productName ?? EMPTY_PLACEHOLDER },
                  { key: '固件版本', value: device.firmwareVersion ?? EMPTY_PLACEHOLDER },
                  { key: '激活时间', value: device.activatedAt ?? '未激活' },
                  { key: '最后在线', value: device.lastSeenAt ?? EMPTY_PLACEHOLDER },
                ]}
              />
              <Banner
                fullMode={false} type="info" closeIcon={null} style={{ marginTop: 12 }}
                description={<Text size="small" type="tertiary">设备侧以 HMAC-SHA256(secret, sn + 时间戳 + 请求体) 签名调用 /api/iot/ingest/*，或携带同款签名参数连接 /api/iot/ws 获得指令实时推送。</Text>}
              />
            </Card>

            {hasPermission('iot:telemetry:view') && (
              <Card
                title="遥测曲线"
                style={{ marginTop: 16 }}
                headerExtraContent={(
                  <RadioGroup type="button" buttonSize="small" value={days} onChange={(e) => setDays(e.target.value as number)}>
                    <Radio value={1}>近 24 时</Radio>
                    <Radio value={7}>近 7 天</Radio>
                    <Radio value={30}>近 30 天</Radio>
                  </RadioGroup>
                )}
              >
                <Spin spinning={telemetryQuery.isPending}>
                  {metricKeys.length > 0 ? (
                    <>
                      <RadioGroup
                        type="button" buttonSize="small" value={activeMetric ?? undefined}
                        onChange={(e) => setMetricKey(e.target.value as string)}
                        style={{ marginBottom: 12 }}
                      >
                        {metricKeys.map((k) => <Radio key={k} value={k}>{k}</Radio>)}
                      </RadioGroup>
                      {isEmptyValues(chartData) ? <EmptyChart height={220} /> : (
                        <AreaChart {...chartSpec} options={chartOptions} height={220} />
                      )}
                    </>
                  ) : (
                    <Empty description="暂无遥测数据，设备上报后自动出现" style={{ padding: '24px 0' }} />
                  )}
                </Spin>
              </Card>
            )}

            {hasPermission('iot:command:send') && (
              <Card title="指令下发" style={{ marginTop: 16 }}>
                <Form
                  layout="horizontal"
                  labelPosition="inset"
                  getFormApi={setFormApi}
                  onSubmit={() => void handleSendCommand()}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}
                >
                  <Form.Input
                    field="service" label="指令" placeholder="如 reboot / set_interval"
                    style={{ width: 200 }} rules={[{ required: true, message: '指令名不能为空' }]}
                  />
                  <Form.Input field="params" label="参数 JSON" placeholder='如 {"interval":60}（选填）' style={{ width: 230 }} />
                  <Form.InputNumber field="ttlSeconds" label="超时秒" placeholder="300" min={10} max={86400} style={{ width: 130 }} />
                  <Button theme="solid" htmlType="submit" loading={sendCommandMutation.isPending}>下发</Button>
                </Form>
                <Text size="small" type="tertiary" style={{ display: 'block', marginTop: 8 }}>
                  设备 WS 在线时即时推送；离线设备在上线或心跳时补收，超时未回执自动标记「已超时」。
                </Text>

                <Table
                  columns={commandColumns}
                  dataSource={commandsQuery.data?.list ?? []}
                  loading={commandsQuery.isFetching}
                  rowKey="id"
                  size="small"
                  empty="暂无指令记录"
                  style={{ marginTop: 12 }}
                  pagination={{
                    currentPage: commandPage,
                    pageSize: 5,
                    total: commandsQuery.data?.total ?? 0,
                    onPageChange: setCommandPage,
                  }}
                />
              </Card>
            )}
          </>
        )}
      </div>
    </SideSheet>
  );
}
