import { Form, Spin, Tag, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { WikiTag } from '@zenith/shared/wiki';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import { KeywordInput } from '@/components/search-filters';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import AppModal from '@/components/AppModal';
import { createdAtColumn } from '@/utils/table-columns';
import { useEditModal } from '@/hooks/useEditModal';
import { usePermission } from '@/hooks/usePermission';
import { useListSearch } from '@/hooks/useListSearch';
import { confirmDelete } from '@/utils/confirm';
import { useDeleteWikiTags, useSaveWikiTag, useWikiTagList, wikiTagKeys } from '@/hooks/queries/wiki-tags';

interface SearchParams {
  keyword: string;
}

const defaultSearchParams: SearchParams = { keyword: '' };

const TAG_COLOR_PRESETS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

export default function WikiTagsPage() {
  const { hasPermission } = usePermission();

  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: defaultSearchParams, listKey: wikiTagKeys.lists });

  const listQuery = useWikiTagList({
    page,
    pageSize,
    keyword: submittedParams.keyword || undefined,
  });
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const modal = useEditModal<WikiTag>({
    entityName: '标签',
    save: useSaveWikiTag(),
    defaults: {},
    toValues: (r) => ({ name: r.name, color: r.color ?? undefined }),
    labelWidth: 72,
  });

  const deleteMutation = useDeleteWikiTags();

  const columns: ColumnProps<WikiTag>[] = [
    {
      title: '标签', dataIndex: 'name', width: 200,
      render: (_: unknown, record: WikiTag) => (
        <Tag style={record.color ? { backgroundColor: record.color, color: '#fff' } : undefined}>{record.name}</Tag>
      ),
    },
    { title: '关联文档数', dataIndex: 'docCount', width: 120, align: 'right' },
    createdAtColumn,
    createOperationColumn<WikiTag>({
      width: 130,
      desktopInlineKeys: ['edit', 'delete'],
      actions: (record) => [
        ...(hasPermission('wiki:tag:edit') ? [{
          key: 'edit', label: '编辑', onClick: () => modal.openEdit(record),
        }] : []),
        ...(hasPermission('wiki:tag:delete') ? [{
          key: 'delete', label: '删除', danger: true,
          onClick: () => {
            confirmDelete({
              title: `确定要删除标签「${record.name}」吗？`,
              content: '删除后关联文档的该标签将被移除',
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
      placeholder="搜索标签名称..."
      value={draftParams.keyword}
      onChange={(v) => setDraftParams((p) => ({ ...p, keyword: v }))}
      onSearch={handleSearch}
    />
  );

  const renderCreateButton = () => hasPermission('wiki:tag:create')
    ? <CreateButton onClick={modal.openCreate} /> : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
        </>}
        actions={renderCreateButton()}
        mobilePrimary={<>
          {renderKeywordSearch()}
          <SearchButton onClick={handleSearch} />
          {renderCreateButton()}
        </>}
      />

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无标签"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      <AppModal {...modal.modalProps} width={480}>
        <Spin spinning={modal.detailLoading} wrapperClassName="modal-spin-wrapper">
          <Form key={modal.formKey} {...modal.formProps}>
            <Form.Input field="name" label="名称" placeholder="请输入标签名称"
              rules={[{ required: true, message: '标签名称不能为空' }]} />
            <Form.RadioGroup field="color" label="颜色" type="pureCard" direction="horizontal">
              {TAG_COLOR_PRESETS.map((c) => (
                <Form.Radio key={c} value={c} style={{ padding: 4 }}>
                  <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 'var(--semi-border-radius-small)', backgroundColor: c }} />
                </Form.Radio>
              ))}
            </Form.RadioGroup>
          </Form>
        </Spin>
      </AppModal>
    </div>
  );
}
