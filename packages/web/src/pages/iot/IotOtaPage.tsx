import { useRef, useState } from 'react';
import {
  Button, Form, Progress, SideSheet, Table, TabPane, Tabs, Tag, Toast, Typography, Upload,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form';
import { FileUp } from 'lucide-react';import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput, StatusSelect } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import { EMPTY_PLACEHOLDER, copyableNoColumn, createdAtColumn, dateTimeColumn, renderEllipsis } from '@/utils/table-columns';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { useUrlTabState } from '@/hooks/useUrlTabState';
import { useDictItems } from '@/hooks/useDictItems';
import { confirmDelete } from '@/utils/confirm';
import { abortSubmit } from '@/lib/abort-submit';
import {
  IOT_OTA_DEVICE_STATUS_LABELS, IOT_OTA_DEVICE_STATUS_OPTIONS, IOT_OTA_TASK_STATUS_LABELS,
  IOT_OTA_TASK_STATUS_OPTIONS,
} from '@zenith/shared/iot';
import type { IotFirmware, IotOtaTask, IotOtaTaskDevice } from '@zenith/shared/iot';
import { useAllIotProducts } from '@/hooks/queries/iot-products';
import { useAllIotGroups } from '@/hooks/queries/iot-groups';
import { useIotDeviceList } from '@/hooks/queries/iot-devices';
import {
  iotFirmwareKeys, iotOtaTaskKeys, useCancelIotOtaTask, useCreateIotOtaTask, useDeleteIotFirmware,
  useReleaseNextIotOtaBatch, useResumeIotOtaTask,
  useIotFirmwareList, useIotOtaTaskDevices, useIotOtaTaskList, useUpdateIotFirmware, useUploadIotFirmware,
} from '@/hooks/queries/iot-ota';

const { Text } = Typography;

const TASK_STATUS_COLORS = { running: 'blue', paused: 'orange', completed: 'green', cancelled: 'grey' } as const;

const DEVICE_STATUS_COLORS = {
  pending: 'grey', notified: 'blue', downloading: 'cyan', installing: 'indigo',
  succeeded: 'green', failed: 'red', cancelled: 'grey',
} as const;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─── 固件包 Tab ───────────────────────────────────────────────────────────────
interface FirmwareSearchParams {
  keyword: string;
  productId: number | null;
  status: string;
}

const defaultFirmwareSearch: FirmwareSearchParams = { keyword: '', productId: null, status: '' };

function FirmwaresTab({ onCreateTask }: Readonly<{ onCreateTask: (firmware: IotFirmware) => void }>) {
  const { hasPermission } = usePermission();
  const { items: statusItems } = useDictItems('common_status');
  const productsQuery = useAllIotProducts();
  const products = productsQuery.data ?? [];

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<FirmwareSearchParams>({ defaults: defaultFirmwareSearch, listKey: iotFirmwareKeys.lists });

  const listQuery = useIotFirmwareList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    productId: submittedParams.productId ?? undefined,
    status: submittedParams.status || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  // 上传固件（multipart 手工编排，不走 useEditModal 的 JSON 语义）
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadFormApi, setUploadFormApi] = useState<FormApi | null>(null);
  const uploadFileRef = useRef<File | null>(null);
  const uploadMutation = useUploadIotFirmware();

  async function handleUploadSubmit() {
    if (!uploadFormApi) abortSubmit();
    let values: Record<string, unknown>;
    try {
      values = await uploadFormApi.validate() as Record<string, unknown>;
    } catch {
      abortSubmit();
    }
    if (!uploadFileRef.current) {
      Toast.warning('请先选择固件文件');
      abortSubmit();
    }
    const formData = new FormData();
    formData.append('file', uploadFileRef.current);
    formData.append('productId', String(values.productId));
    formData.append('version', String(values.version));
    if (values.releaseNotes) formData.append('releaseNotes', String(values.releaseNotes));
    await uploadMutation.mutateAsync({ formData });
    Toast.success('固件已上传');
    setUploadVisible(false);
    uploadFileRef.current = null;
  }

  const editModal = useEditModal<IotFirmware, Record<string, unknown>, Record<string, unknown>>({
    entityName: '固件',
    save: {
      mutateAsync: ({ id, values }) => updateMutation.mutateAsync({ id: id!, values: values as never }),
      isPending: false,
    },
    toValues: (r) => ({ releaseNotes: r.releaseNotes ?? '', status: r.status }),
    beforeSave: (values) => ({
      releaseNotes: (values.releaseNotes as string) || null,
      status: values.status,
    }),
    labelWidth: 90,
  });
  const updateMutation = useUpdateIotFirmware();
  const deleteMutation = useDeleteIotFirmware();

  const columns: ColumnProps<IotFirmware>[] = [
    { title: '版本', dataIndex: 'version', width: 110, render: (v: string) => <Text code>v{v}</Text> },
    { title: '所属产品', dataIndex: 'productName', width: 170, render: (v: string | null) => renderEllipsis(v) },
    { title: '文件名', dataIndex: 'fileName', width: 180, render: (v: string) => renderEllipsis(v) },
    {
      title: '大小', dataIndex: 'size', width: 90, align: 'right',
      render: (v: number) => formatSize(v),
    },
    copyableNoColumn('SHA256', 'sha256', { width: 150 }),
    { title: '任务数', dataIndex: 'taskCount', width: 80, align: 'right' },
    {
      title: '发布说明', dataIndex: 'releaseNotes', width: 200,
      render: (v: string | null) => v ? renderEllipsis(v) : EMPTY_PLACEHOLDER,
    },
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (v: IotFirmware['status']) => (
        <Tag color={v === 'enabled' ? 'green' : 'red'} size="small">{v === 'enabled' ? '启用' : '禁用'}</Tag>
      ),
    },
    createOperationColumn<IotFirmware>({
      width: 200,
      desktopInlineKeys: ['upgrade'],
      actions: (record) => [
        ...(hasPermission('iot:ota:task:create') ? [{
          key: 'upgrade', label: '发起升级',
          disabled: record.status !== 'enabled' || !record.fileId,
          disabledReason: record.status !== 'enabled' ? '固件已禁用' : (!record.fileId ? '固件文件已删除' : undefined),
          onClick: () => onCreateTask(record),
        }] : []),
        ...(hasPermission('iot:ota:firmware:manage') ? [{
          key: 'edit', label: '编辑', onClick: () => editModal.openEdit(record),
        }, {
          key: 'delete', label: '删除', danger: true,
          disabled: (record.taskCount ?? 0) > 0,
          disabledReason: (record.taskCount ?? 0) > 0 ? '存在升级任务' : undefined,
          onClick: () => {
            confirmDelete({
              title: `确定要删除固件 v${record.version} 吗？`,
              content: '托管文件一并回收，不可恢复',
              onOk: async () => {
                await deleteMutation.mutateAsync(record.id);
                Toast.success('删除成功');
              },
            });
          },
        }] : []),
      ],
    }),
  ];

  const renderKeyword = () => (
    <KeywordInput
      placeholder="搜索版本 / 文件名..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderProductFilter = () => (
    <StatusSelect
      placeholder="全部产品"
      items={products.map((p) => ({ value: String(p.id), label: p.name }))}
      value={draftParams.productId === null ? '' : String(draftParams.productId)}
      onChange={(v) => setDraftParams((p) => ({ ...p, productId: v ? Number(v) : null }))}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={statusItems}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderUploadButton = () => hasPermission('iot:ota:firmware:manage')
    ? <CreateButton onClick={() => { setUploadVisible(true); uploadFileRef.current = null; }}>上传固件</CreateButton>
    : null;

  return (
    <>
      <SearchToolbar
        primary={<>
          {renderKeyword()}
          {renderProductFilter()}
          {renderStatusFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        actions={renderUploadButton()}
        mobilePrimary={<>
          {renderKeyword()}
          <SearchButton onClick={handleSearch} />
          {renderUploadButton()}
        </>}
        mobileFilters={<>
          {renderProductFilter()}
          {renderStatusFilter()}
        </>}
        filterTitle="筛选条件"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />
      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无固件包，点击「上传固件」发布第一个版本"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      {/* 上传固件 */}
      <AppModal
        title="上传固件"
        visible={uploadVisible}
        onCancel={() => setUploadVisible(false)}
        onOk={handleUploadSubmit}
        okButtonProps={{ loading: uploadMutation.isPending }}
        width={560}
        closeOnEsc
      >
        <Form labelPosition="left" labelWidth={100} getFormApi={(api) => setUploadFormApi(api)}>
          <Form.Select
            field="productId" label="所属产品" placeholder="选择产品" style={{ width: '100%' }}
            optionList={products.map((p) => ({ value: p.id, label: p.name }))}
            rules={[{ required: true, message: '请选择所属产品' }]}
          />
          <Form.Input
            field="version" label="版本号" placeholder="如 2.0.0"
            extraText="语义化版本，同产品唯一；设备上报一致即判定升级成功"
            rules={[
              { required: true, message: '版本号不能为空' },
              { pattern: /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, message: '需为语义化格式，如 1.2.3 或 1.2.3-beta.1' },
            ]}
          />
          <Form.Slot label="固件文件">
            <Upload
              accept=".bin,.hex,.img,.zip,.gz,.tar"
              limit={1}
              action=""
              beforeUpload={({ file }) => {
                uploadFileRef.current = file.fileInstance ?? null;
                return false;
              }}
              onRemove={() => { uploadFileRef.current = null; }}
            >
              <Button icon={<FileUp size={14} />}>选择文件</Button>
            </Upload>
            <Text type="tertiary" size="small">SHA256 由服务端计算并随升级通知下发，设备侧校验完整性</Text>
          </Form.Slot>
          <Form.TextArea field="releaseNotes" label="发布说明" rows={3} placeholder="本版本变更说明（选填）" maxCount={4000} />
        </Form>
      </AppModal>

      {/* 编辑固件 */}
      <AppModal {...editModal.modalProps} width={520}>
        <Form key={editModal.formKey} {...editModal.formProps}>
          <Form.TextArea field="releaseNotes" label="发布说明" rows={3} maxCount={4000} />
          <Form.RadioGroup field="status" label="状态" extraText="禁用后不可再发起升级任务">
            {statusItems.map((o) => (
              <Form.Radio key={o.value} value={o.value}>{o.label}</Form.Radio>
            ))}
          </Form.RadioGroup>
        </Form>
      </AppModal>
    </>
  );
}

// ─── 升级任务 Tab ─────────────────────────────────────────────────────────────
interface TaskSearchParams {
  keyword: string;
  status: string;
}

const defaultTaskSearch: TaskSearchParams = { keyword: '', status: '' };

function OtaTasksTab({ detailTask, onOpenDetail }: Readonly<{
  detailTask: IotOtaTask | null;
  onOpenDetail: (task: IotOtaTask | null) => void;
}>) {
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<TaskSearchParams>({ defaults: defaultTaskSearch, listKey: iotOtaTaskKeys.lists });

  const listQuery = useIotOtaTaskList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: submittedParams.status || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const cancelMutation = useCancelIotOtaTask();
  const releaseMutation = useReleaseNextIotOtaBatch();
  const resumeMutation = useResumeIotOtaTask();

  const columns: ColumnProps<IotOtaTask>[] = [
    { title: '任务', dataIndex: 'title', width: 210, render: (v: string) => renderEllipsis(v) },
    { title: '所属产品', dataIndex: 'productName', width: 170, render: (v: string | null) => renderEllipsis(v) },
    {
      title: '目标版本', dataIndex: 'firmwareVersion', width: 100,
      render: (v: string) => <Text code>v{v}</Text>,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: IotOtaTask['status']) => (
        <Tag size="small" color={TASK_STATUS_COLORS[v]}>{IOT_OTA_TASK_STATUS_LABELS[v]}</Tag>
      ),
    },
    {
      title: '批次', width: 100,
      render: (_: unknown, r: IotOtaTask) => r.batchSize
        ? <Text size="small" style={{ whiteSpace: 'nowrap' }}>{r.currentBatch} / {r.totalBatches ?? '-'} 批</Text>
        : <Text size="small" type="tertiary">全量</Text>,
    },
    {
      title: '进度', width: 220,
      render: (_: unknown, r: IotOtaTask) => {
        const done = r.succeededCount + r.failedCount;
        const percent = r.totalCount > 0 ? Math.round((done / r.totalCount) * 100) : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress percent={percent} style={{ width: 100 }} aria-label="任务进度" />
            <Text size="small" type="tertiary" style={{ whiteSpace: 'nowrap' }}>
              成功 {r.succeededCount} · 失败 {r.failedCount} / {r.totalCount}
            </Text>
          </div>
        );
      },
    },
    { title: '超时(分)', dataIndex: 'timeoutMinutes', width: 90, align: 'right' },
    createdAtColumn,
    createOperationColumn<IotOtaTask>({
      width: 190,
      desktopInlineKeys: ['detail'],
      actions: (record) => {
        const canRelease = (record.status === 'running' || record.status === 'paused')
          && record.batchSize != null && record.currentBatch < (record.totalBatches ?? 1);
        return [
          { key: 'detail', label: '明细', onClick: () => onOpenDetail(record) },
          ...(hasPermission('iot:ota:task:create') && canRelease ? [{
            key: 'release', label: '放量下一批',
            onClick: () => {
              void releaseMutation.mutateAsync(record.id).then(() => {
                Toast.success('下一批已放量');
              });
            },
          }] : []),
          ...(hasPermission('iot:ota:task:create') && record.status === 'paused' ? [{
            key: 'resume', label: '恢复',
            onClick: () => {
              void resumeMutation.mutateAsync(record.id).then(() => {
                Toast.success('任务已恢复');
              });
            },
          }] : []),
          ...(hasPermission('iot:ota:task:create') && (record.status === 'running' || record.status === 'paused') ? [{
            key: 'cancel', label: '取消', danger: true,
            onClick: () => {
              confirmDelete({
                title: `确定要取消任务「${record.title}」吗？`,
                content: '未终态设备将标记为已取消；已升级成功的设备不受影响',
                onOk: async () => {
                  await cancelMutation.mutateAsync(record.id);
                  Toast.success('任务已取消');
                },
              });
            },
          }] : []),
        ];
      },
    }),
  ];

  const renderKeyword = () => (
    <KeywordInput
      placeholder="搜索任务 / 版本..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      placeholder="全部状态"
      items={IOT_OTA_TASK_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  return (
    <>
      <SearchToolbar
        primary={<>
          {renderKeyword()}
          {renderStatusFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        mobilePrimary={<>
          {renderKeyword()}
          <SearchButton onClick={handleSearch} />
        </>}
        mobileFilters={renderStatusFilter()}
        filterTitle="筛选条件"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />
      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无升级任务，在「固件包」页签对固件「发起升级」"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />
      <OtaTaskDetailDrawer task={detailTask} onClose={() => onOpenDetail(null)} />
    </>
  );
}

/** 任务明细抽屉：设备状态机 + 进度轮询 */
function OtaTaskDetailDrawer({ task, onClose }: Readonly<{ task: IotOtaTask | null; onClose: () => void }>) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const devicesQuery = useIotOtaTaskDevices(
    task?.id ?? null,
    { page, pageSize: 10, status: status || undefined },
    task?.status === 'running',
  );

  const columns: ColumnProps<IotOtaTaskDevice>[] = [
    { title: '设备', dataIndex: 'deviceName', width: 150, render: (v: string | null) => renderEllipsis(v) },
    {
      title: 'SN', dataIndex: 'deviceSn', width: 180,
      render: (v: string | null) => v ? <Text type="tertiary" size="small" style={{ whiteSpace: 'nowrap' }}>{v}</Text> : EMPTY_PLACEHOLDER,
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: IotOtaTaskDevice['status'], r: IotOtaTaskDevice) => (
        <Tag size="small" color={DEVICE_STATUS_COLORS[v]}>
          {IOT_OTA_DEVICE_STATUS_LABELS[v]}{v === 'failed' && r.errorMsg ? `：${r.errorMsg}` : ''}
        </Tag>
      ),
    },
    {
      title: '进度', width: 140,
      render: (_: unknown, r: IotOtaTaskDevice) => (
        <Progress percent={r.progress} showInfo style={{ width: 110 }} aria-label="设备升级进度" />
      ),
    },
    {
      title: '原版本', dataIndex: 'fromVersion', width: 90,
      render: (v: string | null) => v ? <Text code>v{v}</Text> : EMPTY_PLACEHOLDER,
    },
    dateTimeColumn<IotOtaTaskDevice>('通知时间', 'notifiedAt'),
    dateTimeColumn<IotOtaTaskDevice>('完成时间', 'finishedAt'),
  ];

  return (
    <SideSheet
      title={task ? `升级明细 · ${task.title}` : ''}
      visible={task !== null}
      onCancel={onClose}
      width={780}
      closeOnEsc
    >
      {task && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <StatusSelect
              placeholder="全部状态"
              items={IOT_OTA_DEVICE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
            />
            {task.status === 'running' && <Text type="tertiary" size="small">进行中任务每 5 秒自动刷新</Text>}
          </div>
          <Table
            columns={columns}
            dataSource={devicesQuery.data?.list ?? []}
            rowKey="id"
            size="small"
            loading={devicesQuery.isPending}
            empty="暂无设备明细"
            pagination={{
              currentPage: page,
              pageSize: 10,
              total: devicesQuery.data?.total ?? 0,
              onPageChange: setPage,
            }}
          />
        </>
      )}
    </SideSheet>
  );
}

// ─── 发起升级弹窗（固件页签触发，创建后切到任务页签）──────────────────────────
function CreateTaskModal({ firmware, onClose, onCreated }: Readonly<{
  firmware: IotFirmware | null;
  onClose: () => void;
  onCreated: () => void;
}>) {
  const [formApi, setFormApi] = useState<FormApi | null>(null);
  const createMutation = useCreateIotOtaTask();
  const groupsQuery = useAllIotGroups();
  const groups = groupsQuery.data ?? [];
  const devicesQuery = useIotDeviceList(
    { page: 1, pageSize: 100, productId: firmware?.productId },
    firmware !== null,
  );
  const devices = (devicesQuery.data?.list ?? []).filter((d) => d.firmwareVersion !== firmware?.version);
  const [target, setTarget] = useState<'all' | 'group' | 'devices'>('all');

  async function handleSubmit() {
    if (!firmware || !formApi) abortSubmit();
    let values: Record<string, unknown>;
    try {
      values = await formApi.validate() as Record<string, unknown>;
    } catch {
      abortSubmit();
    }
    await createMutation.mutateAsync({
      firmwareId: firmware.id,
      allDevices: target === 'all' ? true : undefined,
      groupId: target === 'group' ? (values.groupId as number) : undefined,
      deviceIds: target === 'devices' ? (values.deviceIds as number[]) : undefined,
      timeoutMinutes: (values.timeoutMinutes as number) || 30,
      batchSize: (values.batchSize as number | undefined) ?? null,
      failureThreshold: (values.failureThreshold as number | undefined) ?? null,
    });
    Toast.success('升级任务已创建，可在「升级任务」页签跟进进度');
    onClose();
    onCreated();
  }

  return (
    <AppModal
      title={firmware ? `发起升级 · v${firmware.version}` : ''}
      visible={firmware !== null}
      onCancel={onClose}
      onOk={handleSubmit}
      okButtonProps={{ loading: createMutation.isPending }}
      width={560}
      closeOnEsc
    >
      {firmware && (
        <Form
          key={firmware.id}
          labelPosition="left"
          labelWidth={100}
          getFormApi={(api) => setFormApi(api)}
          initValues={{ timeoutMinutes: 30 }}
        >
          <Form.Slot label="升级范围">
            <Tabs
              type="button" collapsible="auto" activeKey={target}
              onChange={(k) => setTarget(k as typeof target)}
            >
              <TabPane tab="产品全部设备" itemKey="all" />
              <TabPane tab="按分组" itemKey="group" />
              <TabPane tab="选设备" itemKey="devices" />
            </Tabs>
          </Form.Slot>
          {target === 'group' && (
            <Form.Select
              field="groupId" label="目标分组" placeholder="选择分组" style={{ width: '100%' }}
              optionList={groups.map((g) => ({ value: g.id, label: `${g.name}（${g.deviceCount ?? 0} 台）` }))}
              rules={[{ required: true, message: '请选择分组' }]}
            />
          )}
          {target === 'devices' && (
            <Form.Select
              field="deviceIds" label="目标设备" placeholder="选择设备（可多选）" multiple showClear style={{ width: '100%' }}
              optionList={devices.map((d) => ({ value: d.id, label: `${d.name}（${d.sn}）` }))}
              rules={[{ required: true, message: '请选择目标设备' }]}
            />
          )}
          <Form.InputNumber
            field="timeoutMinutes" label="超时(分钟)" min={5} max={1440} style={{ width: 160 }}
            extraText="超过该时长未完成的设备判为失败"
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.InputNumber
              field="batchSize" label="灰度批次" min={1} max={10000} showClear hideButtons style={{ width: 140 }}
              placeholder="留空 = 全量" extraText="首批 N 台，手动放量推进"
            />
            <Form.InputNumber
              field="failureThreshold" label="熔断阈值(%)" min={1} max={100} showClear hideButtons style={{ width: 140 }}
              placeholder="留空 = 不熔断" extraText="已放量批失败率达标即自动暂停"
            />
          </div>
          <Text type="tertiary" size="small">
            仅产品匹配、已启用且版本不同的设备会进入任务；WS 在线设备立即推送，离线设备心跳时补收。
          </Text>
        </Form>
      )}
    </AppModal>
  );
}

// ─── 页面 ─────────────────────────────────────────────────────────────────────
const OTA_TABS = ['firmwares', 'tasks'] as const;

export default function IotOtaPage() {
  const [activeTab, setActiveTab] = useUrlTabState(OTA_TABS, 'firmwares');
  const [taskFirmware, setTaskFirmware] = useState<IotFirmware | null>(null);
  const [detailTask, setDetailTask] = useState<IotOtaTask | null>(null);

  return (
    <div className="page-container page-tabs-page">
      <Tabs type="line" collapsible="auto" activeKey={activeTab} onChange={(k) => setActiveTab(k as typeof OTA_TABS[number])}>
        <TabPane tab="固件包" itemKey="firmwares">
          <FirmwaresTab onCreateTask={setTaskFirmware} />
        </TabPane>
        <TabPane tab="升级任务" itemKey="tasks">
          <OtaTasksTab detailTask={detailTask} onOpenDetail={setDetailTask} />
        </TabPane>
      </Tabs>
      <CreateTaskModal
        firmware={taskFirmware}
        onClose={() => setTaskFirmware(null)}
        onCreated={() => setActiveTab('tasks')}
      />
    </div>
  );
}

