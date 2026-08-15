import { Button, Form, Tag, Toast, ArrayField, Row, Col, Typography, useFormApi, Spin } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Plus, Trash2 } from 'lucide-react';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import AppModal from '@/components/AppModal';
import { createdAtColumn, renderEllipsis, renderEnabledStatusTag } from '@/utils/table-columns';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import { useListSearch } from '@/hooks/useListSearch';
import { useCmsModelList, useCmsModelDetail, useSaveCmsModel, useDeleteCmsModel, cmsModelKeys } from '@/hooks/queries/cms';
import { useDictList } from '@/hooks/queries/dicts';
import { CMS_FIELD_OPTION_SOURCE_LABELS, CMS_FIELD_OPTION_SOURCES, CMS_FIELD_TYPES, CMS_FIELD_TYPES_WITH_OPTIONS, CMS_FIELD_TYPE_LABELS } from '@zenith/shared/cms';
import type { CmsModel } from '@zenith/shared/cms';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

const FIELD_TYPE_OPTIONS = CMS_FIELD_TYPES.map((t) => ({ value: t, label: CMS_FIELD_TYPE_LABELS[t] }));
const OPTION_SOURCE_OPTIONS = CMS_FIELD_OPTION_SOURCES.map((s) => ({ value: s, label: CMS_FIELD_OPTION_SOURCE_LABELS[s] }));
interface SearchParams { keyword: string }
const defaultSearch: SearchParams = { keyword: '' };

/**
 * 选项来源配置行：仅 select/radio/checkbox 需要，其余类型不渲染避免干扰。
 * 选「引用系统字典」后由服务端按字典编码解析，字典项变更自动同步，无需回来改模型。
 */
function FieldOptionSource({ field }: { field: string }) {
  const formApi = useFormApi();
  const fieldType = formApi.getValue(`${field}[fieldType]`) as string | undefined;
  const optionSource = formApi.getValue(`${field}[optionSource]`) as string | undefined;
  const dictQuery = useDictList({ page: 1, pageSize: 200 });
  const dictOptions = (dictQuery.data?.list ?? []).map((d) => ({ value: d.code, label: `${d.name}（${d.code}）` }));

  if (!CMS_FIELD_TYPES_WITH_OPTIONS.includes(fieldType as (typeof CMS_FIELD_TYPES_WITH_OPTIONS)[number])) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', paddingLeft: 24 }}>
      <Form.Select field={`${field}[optionSource]`} noLabel initValue="manual" style={{ width: 150 }} optionList={OPTION_SOURCE_OPTIONS} />
      {optionSource === 'dict' ? (
        <Form.Select
          field={`${field}[dictCode]`}
          noLabel
          filter
          showClear
          style={{ width: 260 }}
          placeholder="选择字典"
          loading={dictQuery.isFetching}
          optionList={dictOptions}
          rules={[{ required: true, message: '请选择字典' }]}
        />
      ) : (
        <Typography.Text type="tertiary" size="small" style={{ lineHeight: '32px' }}>
          手工选项在字典管理外维护；如需与系统字典联动请切换为「引用系统字典」
        </Typography.Text>
      )}
    </div>
  );
}

export default function ModelsPage() {
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearch, listKey: cmsModelKeys.lists });

  const listQuery = useCmsModelList({ page, pageSize, keyword: submittedParams.keyword || undefined });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const saveMutation = useSaveCmsModel();
  const modal = useEditModal<CmsModel, Record<string, unknown>, Record<string, unknown>>({
    entityName: '模型',
    save: saveMutation,
    useDetail: useCmsModelDetail,
    defaults: { status: 'enabled', fields: [] },
    toValues: (record) => ({
      name: record.name,
      code: record.code,
      description: record.description ?? '',
      status: record.status,
      fields: (record.fields ?? []).map((f) => ({
        name: f.name, label: f.label, fieldType: f.fieldType, required: f.required, searchable: f.searchable, showInList: f.showInList,
        showInDetail: f.showInDetail, detailGroup: f.detailGroup ?? '',
        placeholder: f.placeholder ?? '', optionSource: f.optionSource ?? 'manual', dictCode: f.dictCode ?? '', options: f.options ?? null,
      })),
    }),
    beforeSave: (values) => ({
      ...values,
      // sort 与 detailSort 均按行序落库：模型编辑器内的顺序即后台表单与详情字段表的顺序
      fields: (((values.fields as unknown) as Record<string, unknown>[]) ?? []).map((f, i) => ({ ...f, sort: i, detailSort: i })),
    }),
  });
  const deleteMutation = useDeleteCmsModel();

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync(id);
    Toast.success('删除成功');
  }

  const columns: ColumnProps<CmsModel>[] = [
    {
      title: '模型名称',
      dataIndex: 'name',
      width: 160,
      render: (v: string, record) => (
        <span>
          {v}
          {record.isSystem ? <Tag size="small" style={{ marginLeft: 6 }}>内置</Tag> : null}
        </span>
      ),
    },
    { title: '标识', dataIndex: 'code', width: 120 },
    {
      title: '自定义字段',
      dataIndex: 'fields',
      width: 300,
      render: (fields: CmsModel['fields']) => (fields && fields.length > 0
        ? fields.map((f) => <Tag key={f.name} size="small" style={{ marginRight: 4 }}>{f.label}</Tag>)
        : <span style={{ color: 'var(--semi-color-text-2)' }}>无（仅基础字段）</span>),
    },
    { title: '描述', dataIndex: 'description', width: 220, render: renderEllipsis },
    createdAtColumn,
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      fixed: 'right',
      render: renderEnabledStatusTag,
    },
    createOperationColumn<CmsModel>({
      width: 160,
      desktopInlineKeys: ['edit', 'delete'],
      actions: (record) => [
        ...(hasPermission('cms:model:update') ? [{
          key: 'edit',
          label: '编辑',
          onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('cms:model:delete') && !record.isSystem ? [{
          key: 'delete',
          label: '删除',
          danger: true,
          onClick: () => {
            confirmDelete({ title: '确定要删除该模型吗？', content: '被栏目或内容引用时不可删除', onOk: () => handleDelete(record.id) });
          },
        }] : []),
      ],
    }),
  ];

  return (
    <div className="page-container">
      <SearchToolbar>
        <KeywordInput placeholder="搜索模型名称/标识..." value={draftParams.keyword} onChange={(keyword) => setDraftParams({ keyword })} onSearch={handleSearch} />
        <SearchButton onClick={handleSearch} />
        <ResetButton onClick={handleReset} />
        {hasPermission('cms:model:create') ? (
          <CreateButton onClick={modal.openCreate} />
        ) : null}
      </SearchToolbar>

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无内容模型"
        scroll={{ x: 1220 }}
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      <AppModal {...modal.modalProps} width={860}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
        <Form {...modal.formProps}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Input field="name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]} />
            </Col>
            <Col span={12}>
              <Form.Input field="code" label="模型标识" disabled={modal.isEdit} placeholder="如 article" rules={[{ required: true, message: '请输入模型标识' }]} />
            </Col>
            <Col span={12}>
              <Form.Input field="description" label="描述" />
            </Col>
            <Col span={12}>
              <Form.RadioGroup field="status" label="状态">
                <Form.Radio value="enabled">启用</Form.Radio>
                <Form.Radio value="disabled">停用</Form.Radio>
              </Form.RadioGroup>
            </Col>
          </Row>
          <Form.Section text="自定义字段（基础字段：标题/摘要/正文/封面/作者等已内置，此处配置扩展字段）">
            <ArrayField field="fields">
              {({ add, arrayFields }) => (
                <>
                  {arrayFields.map(({ field, key, remove }) => (
                    <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4, flexWrap: 'wrap' }}>
                      <Form.Input field={`${field}[name]`} noLabel placeholder="字段标识（英文）" style={{ width: 140 }}
                        rules={[{ required: true, message: '必填' }, { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母开头' }]} />
                      <Form.Input field={`${field}[label]`} noLabel placeholder="字段名称" style={{ width: 120 }}
                        rules={[{ required: true, message: '必填' }]} />
                      <Form.Select field={`${field}[fieldType]`} noLabel initValue="text" style={{ width: 120 }} optionList={FIELD_TYPE_OPTIONS} />
                      <Form.Input field={`${field}[placeholder]`} noLabel placeholder="提示文案" style={{ width: 150 }} />
                      <Form.Checkbox field={`${field}[required]`} noLabel>必填</Form.Checkbox>
                      <Form.Checkbox field={`${field}[searchable]`} noLabel>检索</Form.Checkbox>
                      <Form.Checkbox field={`${field}[showInList]`} noLabel>列表显示</Form.Checkbox>
                      <Form.Checkbox field={`${field}[showInDetail]`} noLabel>详情展示</Form.Checkbox>
                      <Form.Input field={`${field}[detailGroup]`} noLabel placeholder="详情分组（如 文件信息）" style={{ width: 150 }} />
                      <Button type="danger" theme="borderless" icon={<Trash2 size={14} />} onClick={() => remove()} style={{ marginTop: 4 }} />
                      <FieldOptionSource field={field} />
                    </div>
                  ))}
                  <Button icon={<Plus size={14} />} onClick={() => add()}>添加字段</Button>
                </>
              )}
            </ArrayField>
          </Form.Section>
        </Form>
        </Spin>
      </AppModal>
    </div>
  );
}
