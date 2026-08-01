import { useEffect, useRef, useState } from 'react';
import { Form, JsonViewer, Select, Spin, Toast } from '@douyinfe/semi-ui';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form/interface';
import type { SystemConfig } from '@zenith/shared/platform';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { formatDateTime } from '@/utils/date';
import DictTag from '@/components/DictTag';
import { useDictItems } from '@/hooks/useDictItems';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { SearchToolbar } from '@/components/SearchToolbar';
import ExportButton from '@/components/ExportButton';
import { AppModal } from '@/components/AppModal';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { renderEllipsis } from '../../../utils/table-columns';
import {
  systemConfigKeys,
  useDeleteSystemConfig,
  useSaveSystemConfig,
  useSystemConfigDetail,
  useSystemConfigList,
} from '@/hooks/queries/system-configs';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

interface SearchParams {
  keyword: string;
  configType: string;
}

const defaultSearchParams: SearchParams = { keyword: '', configType: '' };

/** JSON 文本美化；解析失败时原样返回，避免用户输入被吞掉 */
function prettyJson(raw: string): string {
  const text = (raw ?? '').trim();
  if (!text) return '{}';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default function SystemConfigsPage() {
  const { hasPermission } = usePermission();
  const { items: configTypeItems, loading: configTypeLoading } = useDictItems('system_config_type');
  const formApi = useRef<FormApi | null>(null);
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: systemConfigKeys.lists });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  // json 类型改用 JsonViewer 编辑：jsonSeed 是非受控初始值兼 remount key，jsonText 由 onChange 实时同步供提交读取
  const [configType, setConfigType] = useState<string>('string');
  const [jsonSeed, setJsonSeed] = useState<string>('{}');
  const [jsonText, setJsonText] = useState<string>('{}');

  const seedJsonEditor = (raw: string) => {
    const pretty = prettyJson(raw);
    setJsonSeed(pretty);
    setJsonText(pretty);
  };

  const listQuery = useSystemConfigList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    configType: submittedParams.configType || undefined,
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const detailQuery = useSystemConfigDetail(editingConfig?.id, modalVisible);
  const editing = editingConfig ? (detailQuery.data ?? editingConfig) : null;
  const modalDetailLoading = !!editingConfig && detailQuery.isFetching;
  const saveMutation = useSaveSystemConfig();
  const deleteMutation = useDeleteSystemConfig();

  // 弹窗打开（或详情回填）时同步编辑器状态：类型决定用哪种控件，json 需要美化后的初始文本
  const editingKey = editing ? `${editing.id}:${editing.updatedAt}` : 'new';
  useEffect(() => {
    if (!modalVisible) return;
    setConfigType(editing?.configType ?? 'string');
    seedJsonEditor(editing?.configType === 'json' ? editing.configValue : '{}');
    // editingKey 已覆盖 editing 的身份变化，避免对象引用抖动导致重复重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible, editingKey]);

  const closeModal = () => {
    setModalVisible(false);
    setEditingConfig(null);
  };

  /** 类型切换时在 Input 与 JsonViewer 之间搬运当前值，避免切来切去把内容丢掉 */
  const handleTypeChange = (values: Record<string, unknown>) => {
    const next = (values.configType as string) ?? 'string';
    if (next === configType) return;
    if (next === 'json') {
      seedJsonEditor((values.configValue as string) ?? '');
    } else if (configType === 'json') {
      formApi.current?.setValue('configValue', jsonText);
    }
    setConfigType(next);
  };

  const handleModalOk = async () => {
    let values;
    try { values = await formApi.current!.validate(); } catch { throw new Error('validation'); }

    if (values.configType === 'json') {
      const raw = jsonText.trim();
      if (!raw) {
        Toast.error('请输入配置值');
        throw new Error('empty json');
      }
      try {
        JSON.parse(raw);
      } catch {
        Toast.error('配置值 JSON 格式有误，请检查后重试');
        throw new Error('invalid json');
      }
      values.configValue = raw;
    }

    await saveMutation.mutateAsync({ id: editingConfig?.id, values });
    Toast.success(editingConfig ? '更新成功' : '创建成功');
    closeModal();
  };

  const openEdit = (record: SystemConfig) => {
    setEditingConfig(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync(id);
    Toast.success('删除成功');
  };

  const formInitValues = editing
    ? {
        configKey: editing.configKey,
        configValue: editing.configValue,
        configType: editing.configType,
        description: editing.description,
      }
    : { configType: 'string' };

  const configTypeFilterOptions = [
    { value: '', label: '全部类型' },
    ...configTypeItems.map((item) => ({ value: item.value, label: item.label })),
  ];
  const buildExportQuery = () => ({
    ...(submittedParams.keyword ? { keyword: submittedParams.keyword } : {}),
    ...(submittedParams.configType ? { configType: submittedParams.configType } : {}),
  });

  const configTypeOptions = configTypeItems.map((item) => ({ value: item.value, label: item.label }));

  const columns: ColumnProps<SystemConfig>[] = [
    { title: '配置键', dataIndex: 'configKey', width: 220, render: renderEllipsis },
    { title: '配置值', dataIndex: 'configValue', width: 140, render: renderEllipsis },
    {
      title: '类型',
      dataIndex: 'configType',
      width: 80,
      render: (v: string) => <DictTag dictCode="system_config_type" value={v} />,
    },
    { title: '描述', dataIndex: 'description', width: 300, render: renderEllipsis },
    {
      title: '更新时间', dataIndex: 'updatedAt', width: 180,
      render: (v: string) => formatDateTime(v),
    },
    createOperationColumn<SystemConfig>({
      width: 160,
      actions: (record) => [
        {
          key: 'edit',
          label: '编辑',
          hidden: !hasPermission('system:config:update'),
          onClick: () => { void openEdit(record); },
        },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !hasPermission('system:config:delete'),
          onClick: () => {
            confirmDelete({
              title: '确定要删除此配置吗？',
              onOk: () => handleDelete(record.id),
            });
          },
        },
      ],
    }),
  ];

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
          <KeywordInput placeholder="搜索配置键/描述" value={draftParams.keyword} onChange={(value) => setDraftParams((p) => ({ ...p, keyword: value }))} onSearch={handleSearch} width={240} />
          <Select
            placeholder="配置类型"
            value={draftParams.configType || undefined}
            onChange={(v) => setDraftParams((p) => ({ ...p, configType: (v as string) ?? '' }))}
            style={{ width: 140 }}
            optionList={configTypeFilterOptions}
            loading={configTypeLoading}
          />
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
          <ExportButton entity="system.configs" query={buildExportQuery()} />
          {hasPermission('system:config:create') && (
            <CreateButton onClick={() => { setEditingConfig(null); setModalVisible(true); }} />
          )}
          </>
        )}
        mobilePrimary={(
          <>
            <KeywordInput placeholder="搜索配置键/描述" value={draftParams.keyword} onChange={(value) => setDraftParams((p) => ({ ...p, keyword: value }))} onSearch={handleSearch} width={240} />
            <SearchButton onClick={handleSearch} />
            {hasPermission('system:config:create') && (
              <CreateButton onClick={() => { setEditingConfig(null); setModalVisible(true); }} />
            )}
          </>
        )}
        mobileFilters={(
          <Select
            placeholder="配置类型"
            value={draftParams.configType || undefined}
            onChange={(v) => setDraftParams((p) => ({ ...p, configType: (v as string) ?? '' }))}
            style={{ width: 140 }}
            optionList={configTypeFilterOptions}
            loading={configTypeLoading}
          />
        )}
        mobileActions={(
          <ExportButton entity="system.configs" query={buildExportQuery()} variant="flat" />
        )}
        filterTitle="配置筛选"
        actionTitle="配置操作"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={data}
        loading={listQuery.isFetching}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        rowKey="id"
        pagination={buildPagination(total)}
        empty="暂无数据"
      />

      <AppModal
        title={editing ? '编辑配置' : '新增配置'}
        visible={modalVisible}
        onCancel={closeModal}
        onOk={handleModalOk}
        okButtonProps={{ disabled: modalDetailLoading }}
        width={configType === 'json' ? 720 : 520}
      >
        <Spin spinning={modalDetailLoading} wrapperClassName="modal-spin-wrapper">
        <Form
          key={editingConfig?.id ?? 'new-config'}
          getFormApi={(api) => { formApi.current = api; }}
          allowEmpty
          initValues={formInitValues}
          labelPosition="left"
          labelWidth={90}
          onValueChange={handleTypeChange}
        >
          <Form.Input
            field="configKey"
            label="配置键"
            rules={[{ required: true, message: '请输入配置键' }]}
            disabled={!!editing}
          />
          {configType === 'json' ? (
            <Form.Slot label={{ text: '配置值' }}>
              <JsonViewer
                key={jsonSeed}
                value={jsonSeed}
                onChange={setJsonText}
                height={260}
                width="100%"
              />
            </Form.Slot>
          ) : (
            <Form.Input field="configValue" label="配置值" placeholder="请输入配置值" rules={[{ required: true, message: '请输入配置值' }]} />
          )}
          <Form.Select
            field="configType"
            label="类型"
            optionList={configTypeOptions}
            style={{ width: '100%' }}
            loading={configTypeLoading}
            placeholder="请选择类型"
          />
          <Form.TextArea field="description" label="描述" placeholder="请输入描述" maxCount={256} />
        </Form>
        </Spin>
      </AppModal>
    </div>
  );
}
