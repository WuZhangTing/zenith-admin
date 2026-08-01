import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Form, Select, SideSheet, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form/interface';
import { FolderTree } from 'lucide-react';
import ConfigurableTable from '@/components/ConfigurableTable';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { SearchToolbar } from '@/components/SearchToolbar';
import AppModal from '@/components/AppModal';
import { createdAtColumn } from '@/utils/table-columns';
import { usePermission } from '@/hooks/usePermission';
import { usePagination } from '@/hooks/usePagination';
import {
  useCmsFriendLinkList, useSaveCmsFriendLink, useDeleteCmsFriendLink, cmsFriendLinkKeys,
  useAllCmsFriendLinkGroups, useCmsFriendLinkGroupList, useSaveCmsFriendLinkGroup, useDeleteCmsFriendLinkGroup,
} from '@/hooks/queries/cms';
import type { CmsFriendLink, CmsFriendLinkGroup } from '@zenith/shared/cms';
import { CmsSiteSelect } from './CmsSiteSelect';
import { CreateButton, ResetButton, SearchButton } from '@/components/toolbar-controls';
import { KeywordInput } from '@/components/search-filters';
import { confirmDelete } from '@/utils/confirm';

export default function FriendLinksPage() {
  const { hasPermission } = usePermission();
  const formApi = useRef<FormApi | null>(null);
  const queryClient = useQueryClient();

  const [siteId, setSiteId] = useState<number | undefined>(undefined);
  const { page, pageSize, setPage, buildPagination } = usePagination();
  const [draftKeyword, setDraftKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [groupSheetVisible, setGroupSheetVisible] = useState(false);

  const [draftGroupId, setDraftGroupId] = useState<number | undefined>(undefined);
  const [submittedGroupId, setSubmittedGroupId] = useState<number | undefined>(undefined);
  const groupOptions = useAllCmsFriendLinkGroups(siteId).data ?? [];

  const listQuery = useCmsFriendLinkList({
    page, pageSize, siteId: siteId ?? 0, keyword: submittedKeyword || undefined, groupId: submittedGroupId,
  }, siteId !== undefined);
  const list = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CmsFriendLink | null>(null);
  const saveMutation = useSaveCmsFriendLink();
  const deleteMutation = useDeleteCmsFriendLink();

  function handleSearch() {
    setPage(1);
    setSubmittedKeyword(draftKeyword);
    setSubmittedGroupId(draftGroupId);
    void queryClient.invalidateQueries({ queryKey: cmsFriendLinkKeys.lists });
  }

  function handleReset() {
    setPage(1);
    setDraftKeyword('');
    setSubmittedKeyword('');
    setDraftGroupId(undefined);
    setSubmittedGroupId(undefined);
    void queryClient.invalidateQueries({ queryKey: cmsFriendLinkKeys.lists });
  }

  async function handleModalOk() {
    if (!siteId) return;
    let values: Record<string, unknown>;
    try {
      values = (await formApi.current?.validate()) ?? {};
    } catch {
      throw new Error('validation');
    }
    if (!editingRecord) values.siteId = siteId;
    await saveMutation.mutateAsync({ id: editingRecord?.id, values });
    Toast.success(editingRecord ? '更新成功' : '创建成功');
    setModalVisible(false);
    setEditingRecord(null);
  }

  const columns: ColumnProps<CmsFriendLink>[] = [
    { title: '链接名称', dataIndex: 'name', width: 180 },
    {
      title: '分组', dataIndex: 'groupName', width: 120,
      render: (v: string | null) => v ?? <Typography.Text type="tertiary">未分组</Typography.Text>,
    },
    {
      title: '链接地址',
      dataIndex: 'url',
      width: 300,
      render: (v: string) => <a href={v} target="_blank" rel="noopener noreferrer">{v}</a>,
    },
    { title: '排序', dataIndex: 'sort', width: 80 },
    createdAtColumn,
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      fixed: 'right',
      render: (v: string) => (v === 'enabled' ? <Tag color="green" size="small">启用</Tag> : <Tag color="red" size="small">停用</Tag>),
    },
    createOperationColumn<CmsFriendLink>({
      width: 160,
      desktopInlineKeys: ['edit', 'delete'],
      actions: (record) => [
        ...(hasPermission('cms:link:update') ? [{
          key: 'edit',
          label: '编辑',
          onClick: () => { setEditingRecord(record); setModalVisible(true); },
        }] : []),
        ...(hasPermission('cms:link:delete') ? [{
          key: 'delete',
          label: '删除',
          danger: true,
          onClick: () => {
            confirmDelete({
              title: '确定要删除该友链吗？',
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

  return (
    <div className="page-container">
      <SearchToolbar>
        <CmsSiteSelect value={siteId} onChange={(v) => { setSiteId(v); setPage(1); }} width={180} />
        <KeywordInput placeholder="搜索名称..." value={draftKeyword} onChange={setDraftKeyword} onSearch={handleSearch} width={200} />
        <Select
          placeholder="全部分组"
          showClear
          disabled={!siteId}
          style={{ width: 160 }}
          value={draftGroupId}
          onChange={(v) => setDraftGroupId(v == null ? undefined : Number(v))}
          optionList={[
            { value: 0, label: '未分组' },
            ...groupOptions.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
        <SearchButton onClick={handleSearch} />
        <ResetButton onClick={handleReset} />
        {hasPermission('cms:link:create') ? (
          <CreateButton onClick={() => { setEditingRecord(null); setModalVisible(true); }} />
        ) : null}
        <Button icon={<FolderTree size={14} />} disabled={!siteId} onClick={() => setGroupSheetVisible(true)}>分组管理</Button>
      </SearchToolbar>

      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={list}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无友情链接"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(total)}
      />

      <AppModal
        title={editingRecord ? '编辑友链' : '新增友链'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
        okButtonProps={{ loading: saveMutation.isPending }}
        width={520}
        closeOnEsc
      >
        <Form
          key={editingRecord?.id ?? 'new'}
          getFormApi={(api) => { formApi.current = api; }}
          allowEmpty
          initValues={editingRecord
            ? { name: editingRecord.name, url: editingRecord.url, logo: editingRecord.logo ?? '', groupId: editingRecord.groupId ?? undefined, sort: editingRecord.sort, status: editingRecord.status, remark: editingRecord.remark ?? '' }
            : { sort: 0, status: 'enabled' }}
          labelPosition="left"
          labelWidth={90}
        >
          <Form.Input field="name" label="链接名称" rules={[{ required: true, message: '请输入链接名称' }]} />
          <Form.Input field="url" label="链接地址" placeholder="https://..." rules={[{ required: true, message: '请输入链接地址' }]} />
          <Form.Select field="groupId" label="所属分组" showClear style={{ width: '100%' }} placeholder="未分组"
            optionList={groupOptions.map((g) => ({ value: g.id, label: g.name }))} />
          <Form.Input field="logo" label="Logo URL" />
          <Form.InputNumber field="sort" label="排序" style={{ width: 160 }} />
          <Form.RadioGroup field="status" label="状态">
            <Form.Radio value="enabled">启用</Form.Radio>
            <Form.Radio value="disabled">停用</Form.Radio>
          </Form.RadioGroup>
          <Form.Input field="remark" label="备注" />
        </Form>
      </AppModal>

      <FriendLinkGroupSheet
        siteId={siteId}
        visible={groupSheetVisible}
        onClose={() => setGroupSheetVisible(false)}
      />
    </div>
  );
}

/** 友链分组管理：独立抽屉内做分组 CRUD，避免主列表页承载两套实体的表单 */
function FriendLinkGroupSheet({ siteId, visible, onClose }: Readonly<{
  siteId: number | undefined; visible: boolean; onClose: () => void;
}>) {
  const { hasPermission } = usePermission();
  const groupFormApi = useRef<FormApi | null>(null);
  const { page, pageSize, buildPagination } = usePagination();
  const [editing, setEditing] = useState<CmsFriendLinkGroup | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const listQuery = useCmsFriendLinkGroupList({ page, pageSize, siteId: siteId ?? 0 }, visible && siteId !== undefined);
  const saveMutation = useSaveCmsFriendLinkGroup();
  const deleteMutation = useDeleteCmsFriendLinkGroup();

  async function handleOk() {
    if (!siteId) return;
    let values: Record<string, unknown>;
    try {
      values = (await groupFormApi.current?.validate()) ?? {};
    } catch {
      throw new Error('validation');
    }
    if (!editing) values.siteId = siteId;
    await saveMutation.mutateAsync({ id: editing?.id, values });
    Toast.success(editing ? '更新成功' : '创建成功');
    setFormVisible(false);
    setEditing(null);
  }

  const columns: ColumnProps<CmsFriendLinkGroup>[] = [
    { title: '分组名称', dataIndex: 'name', width: 140 },
    { title: '标识', dataIndex: 'code', width: 120 },
    { title: '友链数', dataIndex: 'linkCount', width: 80 },
    { title: '排序', dataIndex: 'sort', width: 70 },
    createOperationColumn<CmsFriendLinkGroup>({
      width: 120,
      actions: (record) => [
        { key: 'edit', label: '编辑', hidden: !hasPermission('cms:link:update'), onClick: () => { setEditing(record); setFormVisible(true); } },
        {
          key: 'delete',
          label: '删除',
          danger: true,
          hidden: !hasPermission('cms:link:delete'),
          confirm: { title: '删除后组内友链将转为未分组，确定删除？' },
          onClick: async () => { await deleteMutation.mutateAsync(record.id); Toast.success('删除成功'); },
        },
      ],
    }),
  ];

  return (
    <SideSheet title="友链分组管理" visible={visible} onCancel={onClose} width={620}>
      <div style={{ marginBottom: 12 }}>
        {hasPermission('cms:link:create') ? (
          <CreateButton onClick={() => { setEditing(null); setFormVisible(true); }}>新增分组</CreateButton>
        ) : null}
      </div>
      <ConfigurableTable
        bordered
        columns={columns}
        dataSource={listQuery.data?.list ?? []}
        loading={listQuery.isFetching}
        rowKey="id"
        size="small"
        empty="暂无分组"
        onRefresh={() => void listQuery.refetch()}
        refreshLoading={listQuery.isFetching}
        pagination={buildPagination(listQuery.data?.total ?? 0)}
      />
      <AppModal
        title={editing ? '编辑分组' : '新增分组'}
        visible={formVisible}
        onOk={handleOk}
        onCancel={() => { setFormVisible(false); setEditing(null); }}
        okButtonProps={{ loading: saveMutation.isPending }}
        width={480}
        closeOnEsc
      >
        <Form
          key={editing?.id ?? 'new'}
          getFormApi={(api) => { groupFormApi.current = api; }}
          allowEmpty
          initValues={editing
            ? { name: editing.name, code: editing.code, sort: editing.sort, status: editing.status, remark: editing.remark ?? '' }
            : { sort: 0, status: 'enabled' }}
          labelPosition="left"
          labelWidth={90}
        >
          <Form.Input field="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]} />
          <Form.Input field="code" label="分组标识" placeholder="如 tech" disabled={!!editing}
            extraText="主题按组取数的稳定引用，创建后不可修改"
            rules={[{ required: true, message: '请输入分组标识' }, { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字、中划线' }]} />
          <Form.InputNumber field="sort" label="排序" style={{ width: 160 }} />
          <Form.RadioGroup field="status" label="状态">
            <Form.Radio value="enabled">启用</Form.Radio>
            <Form.Radio value="disabled">停用</Form.Radio>
          </Form.RadioGroup>
          <Form.Input field="remark" label="备注" />
        </Form>
      </AppModal>
    </SideSheet>
  );
}
