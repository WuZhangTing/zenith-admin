import { Col, Form, Modal, Row, Spin, Switch, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { CreateWikiTemplateInput, WikiTemplate } from '@zenith/shared/wiki';
import { USER_STATUSES, enumValueOf } from '@zenith/shared/core';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput, StatusSelect } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import { createdAtColumn, renderEllipsis } from '@/utils/table-columns';
import { useDictItems } from '@/hooks/useDictItems';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { confirmDelete } from '@/utils/confirm';
import {
  useDeleteWikiTemplates, useSaveWikiTemplate, useWikiTemplateDetail, useWikiTemplateList, wikiTemplateKeys,
} from '@/hooks/queries/wiki-templates';

interface SearchParams {
  keyword: string;
  status?: string;
}

const defaultSearchParams: SearchParams = { keyword: '', status: '' };

export default function WikiTemplatesPage() {
  const { hasPermission } = usePermission();

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: wikiTemplateKeys.lists });

  const listQuery = useWikiTemplateList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
    status: enumValueOf(USER_STATUSES, submittedParams.status),
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const modal = useEditModal<WikiTemplate, Partial<CreateWikiTemplateInput>>({
    entityName: '文档模板',
    save: useSaveWikiTemplate(),
    useDetail: useWikiTemplateDetail,
    defaults: { status: 'enabled', sort: 0, content: '' },
    // 记录里的 null 在表单中归一为未填
    toValues: (r) => ({
      name: r.name,
      description: r.description ?? undefined,
      content: r.content,
      status: r.status,
      sort: r.sort,
    }),
  });

  const toggleStatusMutation = useSaveWikiTemplate();
  const deleteMutation = useDeleteWikiTemplates();
  const togglingId = toggleStatusMutation.isPending ? (toggleStatusMutation.variables?.id ?? null) : null;
  const { items: statusItems } = useDictItems('common_status');

  function handleToggleStatus(record: WikiTemplate, checked: boolean) {
    const doToggle = () => {
      toggleStatusMutation.mutate(
        { id: record.id, values: { status: checked ? 'enabled' : 'disabled' } },
        { onSuccess: () => Toast.success(checked ? '已启用' : '已停用') },
      );
    };
    if (checked) doToggle();
    else Modal.confirm({
      title: '确认停用',
      content: `停用后「${record.name}」将不再出现在编辑器模板选择中，确认停用？`,
      onOk: doToggle,
    });
  }

  const columns: ColumnProps<WikiTemplate>[] = [
    { title: '模板名称', dataIndex: 'name', width: 200, render: renderEllipsis },
    { title: '描述', dataIndex: 'description', minWidth: 260, render: renderEllipsis },
    { title: '排序', dataIndex: 'sort', width: 80 },
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (_: unknown, record: WikiTemplate) => (
        <Switch
          checked={record.status === 'enabled'}
          loading={togglingId === record.id}
          disabled={!hasPermission('wiki:template:edit')}
          onChange={(checked) => handleToggleStatus(record, checked)}
          size="small"
        />
      ),
    },
    createOperationColumn<WikiTemplate>({
      width: 150,
      desktopInlineKeys: ['edit', 'delete'],
      actions: (record) => [
        ...(hasPermission('wiki:template:edit') ? [{
          key: 'edit', label: '编辑', onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('wiki:template:delete') ? [{
          key: 'delete', label: '删除', danger: true,
          onClick: () => {
            confirmDelete({
              title: `确定要删除模板「${record.name}」吗？`,
              content: '删除后不可恢复，不影响已用模板创建的文档',
              onOk: async () => {
                await deleteMutation.mutateAsync([record.id]);
                Toast.success('删除成功');
              },
            });
          },
        }] : []),
      ],
    }),
  ];

  const renderKeywordSearch = () => (
    <KeywordInput
      placeholder="搜索模板名称..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderStatusFilter = () => (
    <StatusSelect
      items={statusItems}
      value={draftParams.status}
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v }))}
    />
  );

  const renderCreateButton = () => hasPermission('wiki:template:create')
    ? <CreateButton onClick={modal.openCreate} /> : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={<>
          {renderKeywordSearch()}
          {renderStatusFilter()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        actions={renderCreateButton()}
        mobilePrimary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
          {renderCreateButton()}
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
        empty="暂无模板"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      <AppModal {...modal.modalProps} width={660}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form key={modal.formKey} {...modal.formProps}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Input field="name" label="模板名称" placeholder="请输入模板名称"
                  rules={[{ required: true, message: '模板名称不能为空' }]} />
              </Col>
              <Col span={12}>
                <Form.InputNumber field="sort" label="排序" style={{ width: '100%' }} />
              </Col>
            </Row>
            <Form.Input field="description" label="描述" placeholder="模板用途简介（选填）" />
            <Form.TextArea field="content" label="模板内容" placeholder="Markdown 模板内容"
              rows={12} style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", fontSize: 13 }} />
            <Row gutter={16}>
              <Col span={12}>
                <Form.Select field="status" label="状态" style={{ width: '100%' }}
                  optionList={statusItems.map((i) => ({ value: i.value, label: i.label }))}
                  rules={[{ required: true, message: '请选择状态' }]} />
              </Col>
            </Row>
          </Form>
        </Spin>
      </AppModal>
    </div>
  );
}
