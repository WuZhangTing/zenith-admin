import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, Form, Tag, Toast } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import AppModal from '@/components/AppModal';
import { createdAtColumn } from '@/utils/table-columns';
import { usePermission } from '@/hooks/usePermission';
import { useEditModal } from '@/hooks/useEditModal';
import { usePagination } from '@/hooks/usePagination';
import { useCmsErrorProneWordList, useSaveCmsErrorProneWord, useDeleteCmsErrorProneWord, cmsErrorProneWordKeys } from '@/hooks/queries/cms';
import type { CmsErrorProneWord } from '@zenith/shared/cms';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

export default function ErrorProneWordsPage() {
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, buildPagination } = usePagination();
  const [draftKeyword, setDraftKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const listQuery = useCmsErrorProneWordList({ page, pageSize, keyword: submittedKeyword || undefined });
  const saveMutation = useSaveCmsErrorProneWord();
  const modal = useEditModal<CmsErrorProneWord, Partial<CmsErrorProneWord>, Record<string, unknown>>({
    entityName: '易错词',
    save: saveMutation,
    defaults: { status: 'enabled' },
    toValues: (record) => ({ word: record.word, correction: record.correction, remark: record.remark ?? '', status: record.status }),
    beforeSave: (values) => ({ ...values, remark: values.remark || null }),
  });
  const deleteMutation = useDeleteCmsErrorProneWord();
  const canManage = hasPermission('cms:word:manage');

  function handleSearch() {
    setPage(1);
    setSubmittedKeyword(draftKeyword);
    void queryClient.invalidateQueries({ queryKey: cmsErrorProneWordKeys.lists });
  }

  function handleReset() {
    setPage(1);
    setDraftKeyword('');
    setSubmittedKeyword('');
    void queryClient.invalidateQueries({ queryKey: cmsErrorProneWordKeys.lists });
  }

  const columns: ColumnProps<CmsErrorProneWord>[] = [
    { title: '易错词', dataIndex: 'word', width: 180 },
    {
      title: '正确写法',
      dataIndex: 'correction',
      width: 200,
      render: (v: string) => <Tag size="small" color="green">{v}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', width: 220, render: (v: string | null) => v ?? '-' },
    createdAtColumn,
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right',
      render: (v: string) => (v === 'enabled' ? <Tag color="green" size="small">启用</Tag> : <Tag color="red" size="small">停用</Tag>),
    },
    createOperationColumn<CmsErrorProneWord>({
      width: 160,
      desktopInlineKeys: ['edit', 'delete'],
      actions: (record) => canManage ? [
        { key: 'edit', label: '编辑', onClick: () => modal.openEdit(record) },
        {
          key: 'delete', label: '删除', danger: true,
          onClick: () => {
            confirmDelete({
              title: '确定要删除该易错词吗？',
              onOk: async () => {
                await deleteMutation.mutateAsync(record.id);
                Toast.success('删除成功');
              },
            });
          },
        },
      ] : [],
    }),
  ];

  return (
    <div className="page-container">
      <Banner type="info" closeIcon={null} style={{ marginBottom: 12 }} description="易错词库用于内容编辑辅助：在内容编辑页点击「内容检查」可标出正文中的易错词，并支持一键替换为正确写法。" />
      <SearchToolbar>
        <KeywordInput placeholder="搜索易错词/正确写法..." value={draftKeyword} onChange={setDraftKeyword} onSearch={handleSearch} />
        <SearchButton onClick={handleSearch} />
        <ResetButton onClick={handleReset} />
        {canManage ? <CreateButton onClick={modal.openCreate} /> : null}
      </SearchToolbar>

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={listQuery.data?.list ?? []}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无易错词"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(listQuery.data?.total ?? 0)}
      />

      <AppModal {...modal.modalProps} width={480}>
        <Form {...modal.formProps}>
          <Form.Input field="word" label="易错词" rules={[{ required: true, message: '请输入易错词' }]} />
          <Form.Input field="correction" label="正确写法" rules={[{ required: true, message: '请输入正确写法' }]} />
          <Form.Input field="remark" label="备注" placeholder="可选" />
          <Form.RadioGroup field="status" label="状态">
            <Form.Radio value="enabled">启用</Form.Radio>
            <Form.Radio value="disabled">停用</Form.Radio>
          </Form.RadioGroup>
        </Form>
      </AppModal>
    </div>
  );
}
