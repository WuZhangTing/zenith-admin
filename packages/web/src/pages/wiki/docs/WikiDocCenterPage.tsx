import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner, Button, Checkbox, Divider, Dropdown, Empty, List, Select, Space, Spin, Tabs, Tag, TextArea, Toast, Tooltip, Tree, TreeSelect, Typography } from '@douyinfe/semi-ui';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import {
  Bell, Eye, FilePlus2, FolderInput, History, MessageSquare, MoreHorizontal, Pencil, Pin, Send, Star, Trash2, Undo2,
} from 'lucide-react';
import type { WikiComment, WikiDocTreeNode } from '@zenith/shared/wiki';
import { WIKI_DOC_STATUS_LABELS } from '@zenith/shared/wiki';
import { MasterDetailLayout } from '@/components/MasterDetailLayout';
import MarkdownPreviewPanel from '@/components/MarkdownPreviewPanel';
import FileAttachment from '@/components/FileAttachment';
import AppModal from '@/components/AppModal';
import { KeywordInput } from '@/components/search-filters';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/hooks/useAuth';
import { confirmDelete } from '@/utils/confirm';
import { useAllUsers } from '@/hooks/queries/users';
import { useMyWikiSpaces } from '@/hooks/queries/wiki-spaces';
import {
  useConfirmWikiDocRead, useDeleteWikiDocs, useFavoriteWikiDoc, useMoveWikiDoc, useMyFavoriteWikiDocs,
  useRecentWikiDocs, useRecordWikiDocView, useReportWikiSearchClick, useSubmitWikiDoc, useSubscribeWikiDoc,
  useWikiDocDetail, useWikiDocList, useWikiDocReadReceipts, useWikiDocSearch, useWikiDocTree, useWithdrawWikiDoc,
} from '@/hooks/queries/wiki-docs';
import { useCreateWikiComment, useDeleteMyWikiComment, useResolveWikiComment, useWikiDocComments } from '@/hooks/queries/wiki-comments';

const { Text, Title } = Typography;

const STATUS_TAG_COLOR: Record<string, 'grey' | 'orange' | 'green' | 'red'> = {
  draft: 'grey',
  pending: 'orange',
  published: 'green',
  rejected: 'red',
};

function toTreeData(nodes: WikiDocTreeNode[]): TreeNodeData[] {
  return nodes.map((n) => ({
    key: String(n.id),
    value: n.id,
    label: (
      <Space spacing={4}>
        {n.isPinned ? <Pin size={12} style={{ color: 'var(--semi-color-warning)' }} /> : null}
        <span>{n.title}</span>
        {n.status !== 'published' ? (
          <Tag size="small" color={STATUS_TAG_COLOR[n.status]}>{WIKI_DOC_STATUS_LABELS[n.status]}</Tag>
        ) : null}
      </Space>
    ),
    children: n.children?.length ? toTreeData(n.children) : undefined,
  }));
}

/** 目录树转移动目标选择数据（纯文本 label，排除自身子树防环） */
function toMoveTreeData(nodes: WikiDocTreeNode[], excludeId: number): TreeNodeData[] {
  return nodes
    .filter((n) => n.id !== excludeId)
    .map((n) => ({
      key: String(n.id),
      value: n.id,
      label: n.title,
      children: n.children?.length ? toMoveTreeData(n.children, excludeId) : undefined,
    }));
}

function CommentItem({ comment, canDelete, canResolve, onReply, onDelete, onResolve }: {
  comment: WikiComment;
  canDelete: (c: WikiComment) => boolean;
  canResolve: (c: WikiComment) => boolean;
  onReply: (c: WikiComment) => void;
  onDelete: (c: WikiComment) => void;
  onResolve: (c: WikiComment) => void;
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <Space spacing={8}>
        <Text strong>{comment.authorName ?? '已注销用户'}</Text>
        <Text type="tertiary" size="small">{comment.createdAt}</Text>
        {comment.isQuestion ? (
          comment.resolvedAt
            ? <Tag size="small" color="green">已解决</Tag>
            : <Tag size="small" color="orange">问题</Tag>
        ) : null}
      </Space>
      <div style={{ margin: '4px 0' }}>{comment.content}</div>
      <Space spacing={4}>
        <Button size="small" theme="borderless" type="tertiary" onClick={() => onReply(comment)}>回复</Button>
        {comment.isQuestion && !comment.resolvedAt && canResolve(comment) ? (
          <Button size="small" theme="borderless" onClick={() => onResolve(comment)}>标记解决</Button>
        ) : null}
        {canDelete(comment) ? (
          <Button size="small" theme="borderless" type="danger" onClick={() => onDelete(comment)}>删除</Button>
        ) : null}
      </Space>
      {comment.replies?.length ? (
        <div style={{ marginLeft: 24, borderLeft: '2px solid var(--semi-color-border)', paddingLeft: 12 }}>
          {comment.replies.map((r) => (
            <CommentItem key={r.id} comment={r} canDelete={canDelete} canResolve={canResolve}
              onReply={onReply} onDelete={onDelete} onResolve={onResolve} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function WikiDocCenterPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { user } = useAuth();

  const [spaceId, setSpaceId] = useState<number>();
  const [selectedDocId, setSelectedDocId] = useState<number>();
  const [showDetailOnNarrow, setShowDetailOnNarrow] = useState(false);
  const [masterTab, setMasterTab] = useState('tree');
  const [moveTarget, setMoveTarget] = useState<{ id: number; title: string } | null>(null);
  const [moveParentId, setMoveParentId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<WikiComment | null>(null);
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const [isQuestion, setIsQuestion] = useState(false);
  const [receiptsVisible, setReceiptsVisible] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // ─── 数据 ─────────────────────────────────────────────────────────────────
  const spacesQuery = useMyWikiSpaces();
  const spaces = useMemo(() => spacesQuery.data ?? [], [spacesQuery.data]);
  const effectiveSpaceId = spaceId ?? spaces[0]?.id;
  const currentSpace = spaces.find((s) => s.id === effectiveSpaceId);
  const myRole = currentSpace?.myRole ?? null;
  const canWrite = myRole === 'owner' || myRole === 'admin' || myRole === 'editor';

  const treeQuery = useWikiDocTree(effectiveSpaceId);
  const favoritesQuery = useMyFavoriteWikiDocs({ page: 1, pageSize: 50 }, masterTab === 'favorites');
  const recentQuery = useRecentWikiDocs(masterTab === 'recent');
  const myDocsQuery = useWikiDocList({ page: 1, pageSize: 50, mine: true }, masterTab === 'mine');
  const searchQuery = useWikiDocSearch({ page: 1, pageSize: 30, keyword: searchKeyword }, masterTab === 'search');
  const docQuery = useWikiDocDetail(selectedDocId);
  const doc = docQuery.data;
  const commentsQuery = useWikiDocComments(selectedDocId, !!doc && doc.status === 'published');
  const isDocAuthor = !!doc && doc.createdBy === user?.id;
  const canManageDoc = myRole === 'owner' || myRole === 'admin';
  const usersQuery = useAllUsers({ enabled: !!doc && doc.status === 'published' });
  const receiptsQuery = useWikiDocReadReceipts(selectedDocId, receiptsVisible);

  // ─── 变更 ─────────────────────────────────────────────────────────────────
  const favoriteMutation = useFavoriteWikiDoc();
  const subscribeMutation = useSubscribeWikiDoc();
  const submitMutation = useSubmitWikiDoc();
  const withdrawMutation = useWithdrawWikiDoc();
  const deleteMutation = useDeleteWikiDocs();
  const moveMutation = useMoveWikiDoc();
  const viewMutation = useRecordWikiDocView();
  const createCommentMutation = useCreateWikiComment();
  const deleteCommentMutation = useDeleteMyWikiComment();
  const resolveCommentMutation = useResolveWikiComment();
  const confirmReadMutation = useConfirmWikiDocRead();
  const searchClickMutation = useReportWikiSearchClick();

  function selectDoc(id: number) {
    setSelectedDocId(id);
    setShowDetailOnNarrow(true);
    viewMutation.mutate(id);
  }

  function selectSearchResult(id: number) {
    if (searchKeyword) searchClickMutation.mutate({ keyword: searchKeyword, docId: id });
    selectDoc(id);
  }

  function handleSubmitComment() {
    const content = commentText.trim();
    if (!content || !selectedDocId) return;
    createCommentMutation.mutate(
      { docId: selectedDocId, parentId: replyTo?.id ?? null, content, mentionedUserIds: mentionIds, isQuestion },
      {
        onSuccess: () => {
          Toast.success('评论成功');
          setCommentText('');
          setReplyTo(null);
          setMentionIds([]);
          setIsQuestion(false);
        },
      },
    );
  }

  const canEditDoc = canWrite && hasPermission('wiki:doc:edit');
  const canDeleteDoc = canWrite && hasPermission('wiki:doc:delete');
  const canSubmitDoc = canWrite && hasPermission('wiki:doc:publish');
  const canMoveDoc = canWrite && hasPermission('wiki:doc:move');

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  const treeData = useMemo(() => toTreeData(treeQuery.data ?? []), [treeQuery.data]);

  const detailContent = !selectedDocId ? (
    <Empty title="选择文档开始阅读" description="从左侧目录树选择一篇文档" style={{ marginTop: 80 }} />
  ) : docQuery.isPending ? (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}><Spin size="large" /></div>
  ) : docQuery.isError || !doc ? (
    <Empty title="文档不可用" description="文档不存在或没有访问权限" style={{ marginTop: 80 }} />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* 标题与操作 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <Space spacing={8}>
            <Title heading={4} style={{ margin: 0 }}>{doc.title}</Title>
            <Tag color={STATUS_TAG_COLOR[doc.status]}>{WIKI_DOC_STATUS_LABELS[doc.status]}</Tag>
            {doc.isPinned ? <Tag color="amber">置顶</Tag> : null}
          </Space>
          <div style={{ marginTop: 6 }}>
            <Space spacing={12}>
              <Text type="tertiary" size="small">{doc.authorName ?? '—'}</Text>
              <Text type="tertiary" size="small">更新于 {doc.updatedAt}</Text>
              <Text type="tertiary" size="small"><Eye size={12} style={{ verticalAlign: -2 }} /> {doc.viewCount}</Text>
              <Text type="tertiary" size="small">v{doc.currentVersion}</Text>
              {doc.requireReadReceipt && (isDocAuthor || canManageDoc) ? (
                <Button size="small" theme="borderless" onClick={() => setReceiptsVisible(true)}>
                  已读 {doc.readReceiptCount ?? 0} 人
                </Button>
              ) : null}
            </Space>
          </div>
          {doc.tags?.length ? (
            <Space spacing={4} style={{ marginTop: 6 }}>
              {doc.tags.map((t) => <Tag key={t.id} size="small" style={t.color ? { backgroundColor: t.color, color: '#fff' } : undefined}>{t.name}</Tag>)}
            </Space>
          ) : null}
          {doc.status === 'rejected' && doc.rejectReason ? (
            <div style={{ marginTop: 6 }}><Text type="danger" size="small">驳回意见：{doc.rejectReason}</Text></div>
          ) : null}
        </div>
        <Space spacing={4}>
          <Tooltip content={doc.favorited ? '取消收藏' : '收藏'}>
            <Button
              theme="borderless"
              icon={<Star size={16} fill={doc.favorited ? 'var(--semi-color-warning)' : 'none'}
                style={doc.favorited ? { color: 'var(--semi-color-warning)' } : undefined} />}
              loading={favoriteMutation.isPending}
              onClick={() => favoriteMutation.mutate({ id: doc.id, favorite: !doc.favorited })}
            />
          </Tooltip>
          <Tooltip content={doc.subscribed ? '取消订阅（发布/评论通知）' : '订阅更新（发布/评论通知）'}>
            <Button
              theme="borderless"
              icon={<Bell size={16} fill={doc.subscribed ? 'var(--semi-color-primary)' : 'none'}
                style={doc.subscribed ? { color: 'var(--semi-color-primary)' } : undefined} />}
              loading={subscribeMutation.isPending}
              onClick={() => subscribeMutation.mutate(
                { id: doc.id, subscribe: !doc.subscribed },
                { onSuccess: () => Toast.success(doc.subscribed ? '已取消订阅' : '已订阅，更新时将通知你') },
              )}
            />
          </Tooltip>
          {canEditDoc && doc.status !== 'pending' ? (
            <Button icon={<Pencil size={14} />} onClick={() => navigate(`/wiki/docs/edit?id=${doc.id}`)}>编辑</Button>
          ) : null}
          {canSubmitDoc && (doc.status === 'draft' || doc.status === 'rejected') ? (
            <Button
              theme="solid"
              icon={<Send size={14} />}
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate(doc.id, {
                onSuccess: (saved) => Toast.success(saved.status === 'published' ? '已发布' : '已提交审核'),
              })}
            >
              提交发布
            </Button>
          ) : null}
          {doc.status === 'pending' && isDocAuthor ? (
            <Button
              icon={<Undo2 size={14} />}
              loading={withdrawMutation.isPending}
              onClick={() => withdrawMutation.mutate(doc.id, { onSuccess: () => Toast.success('已撤回，可继续编辑') })}
            >
              撤回审核
            </Button>
          ) : null}
          <Dropdown
            trigger="click"
            clickToHide
            position="bottomRight"
            render={(
              <Dropdown.Menu>
                <Dropdown.Item icon={<History size={14} />} onClick={() => navigate(`/wiki/docs/history?id=${doc.id}`)}>
                  版本历史
                </Dropdown.Item>
                {canMoveDoc ? (
                  <Dropdown.Item icon={<FolderInput size={14} />} onClick={() => { setMoveTarget({ id: doc.id, title: doc.title }); setMoveParentId(doc.parentId ?? null); }}>
                    移动
                  </Dropdown.Item>
                ) : null}
                {canDeleteDoc ? (
                  <Dropdown.Item
                    type="danger"
                    icon={<Trash2 size={14} />}
                    onClick={() => confirmDelete({
                      title: `确定要删除「${doc.title}」吗？`,
                      content: '删除后可在回收站还原',
                      onOk: async () => {
                        await deleteMutation.mutateAsync([doc.id]);
                        Toast.success('已移入回收站');
                        setSelectedDocId(undefined);
                      },
                    })}
                  >
                    删除
                  </Dropdown.Item>
                ) : null}
              </Dropdown.Menu>
            )}
          >
            <Button theme="borderless" type="tertiary" icon={<MoreHorizontal size={16} />} />
          </Dropdown>
        </Space>
      </div>

      <Divider margin={12} />

      {doc.status === 'published' && doc.requireReadReceipt && !doc.readConfirmed ? (
        <Banner
          type="warning"
          closeIcon={null}
          style={{ marginBottom: 8 }}
          description="本文档要求阅读确认，请阅读完成后点击确认。"
        >
          <Button
            size="small"
            theme="solid"
            loading={confirmReadMutation.isPending}
            onClick={() => confirmReadMutation.mutate(doc.id, { onSuccess: () => Toast.success('已确认阅读') })}
          >
            确认已读
          </Button>
        </Banner>
      ) : null}

      {/* 正文与评论 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <MarkdownPreviewPanel content={doc.content ?? ''} style={{ height: 'auto', overflowY: 'visible' }} />

        {doc.attachments?.length ? (
          <div style={{ marginTop: 16, maxWidth: 720 }}>
            <FileAttachment mode="view" value={doc.attachments} title={`附件（${doc.attachments.length}）`} />
          </div>
        ) : null}

        {doc.status === 'published' ? (
          <div style={{ marginTop: 24 }}>
            <Divider align="left"><MessageSquare size={14} style={{ verticalAlign: -2, marginRight: 4 }} />评论（{doc.commentCount ?? 0}）</Divider>
            <div style={{ maxWidth: 720 }}>
              {replyTo ? (
                <div style={{ marginBottom: 4 }}>
                  <Tag closable onClose={() => setReplyTo(null)}>回复 {replyTo.authorName ?? '评论'}</Tag>
                </div>
              ) : null}
              <TextArea
                value={commentText}
                onChange={setCommentText}
                placeholder="写下你的评论..."
                rows={2}
                maxCount={1000}
              />
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <Space spacing={8}>
                  <Select
                    multiple
                    size="small"
                    style={{ minWidth: 160 }}
                    placeholder="@ 提及同事（选填）"
                    value={mentionIds}
                    maxTagCount={2}
                    showClear
                    filter
                    onChange={(v) => setMentionIds((v as number[]) ?? [])}
                    optionList={(usersQuery.data ?? []).map((u) => ({ value: u.id, label: u.nickname || u.username }))}
                  />
                  <Checkbox checked={isQuestion} onChange={(e) => setIsQuestion(!!e.target.checked)}>
                    标记为问题
                  </Checkbox>
                </Space>
                <Button
                  theme="solid"
                  loading={createCommentMutation.isPending}
                  disabled={!commentText.trim()}
                  onClick={handleSubmitComment}
                >
                  发表评论
                </Button>
              </div>
              <div>
                {(commentsQuery.data ?? []).map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    canDelete={(cm) => cm.authorId === user?.id}
                    canResolve={(cm) => cm.authorId === user?.id || isDocAuthor || canManageDoc}
                    onReply={(cm) => setReplyTo(cm)}
                    onResolve={(cm) => resolveCommentMutation.mutate(
                      { id: cm.id, docId: cm.docId },
                      { onSuccess: () => Toast.success('已标记解决') },
                    )}
                    onDelete={(cm) => confirmDelete({
                      title: '确定要删除这条评论吗？',
                      onOk: async () => {
                        await deleteCommentMutation.mutateAsync({ id: cm.id, docId: cm.docId });
                        Toast.success('删除成功');
                      },
                    })}
                  />
                ))}
                {commentsQuery.data?.length === 0 ? <Text type="tertiary">暂无评论，来抢沙发</Text> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="page-container page-container--stretch">
      <MasterDetailLayout
        persistKey="wiki-doc-center"
        defaultSize={280}
        minSize={220}
        maxSize={420}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        showDetail={showDetailOnNarrow}
        onBack={() => setShowDetailOnNarrow(false)}
        master={(
          <>
            <MasterDetailLayout.Header
              extra={canWrite && hasPermission('wiki:doc:create') ? (
                <Tooltip content="新建文档">
                  <Button
                    size="small"
                    theme="borderless"
                    icon={<FilePlus2 size={15} />}
                    onClick={() => navigate(`/wiki/docs/edit?spaceId=${effectiveSpaceId}`)}
                  />
                </Tooltip>
              ) : null}
            >
              <Select
                style={{ width: '100%' }}
                placeholder="选择知识空间"
                value={effectiveSpaceId}
                loading={spacesQuery.isPending}
                onChange={(v) => { setSpaceId(v as number); setSelectedDocId(undefined); }}
                optionList={spaces.map((s) => ({ value: s.id, label: s.name }))}
              />
            </MasterDetailLayout.Header>
            <MasterDetailLayout.Body padding={8}>
              <Tabs
                type="button"
                size="small"
                collapsible="auto"
                activeKey={masterTab}
                onChange={setMasterTab}
              >
                <Tabs.TabPane tab="目录" itemKey="tree">
                  {treeQuery.isPending && effectiveSpaceId !== undefined ? (
                    <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
                  ) : treeData.length === 0 ? (
                    <Empty description="空间还没有文档" style={{ marginTop: 32 }} />
                  ) : (
                    <Tree
                      treeData={treeData}
                      value={selectedDocId !== undefined ? String(selectedDocId) : undefined}
                      onChange={(v) => selectDoc(Number(v))}
                      filterTreeNode
                      showFilteredOnly
                      searchPlaceholder="搜索文档标题..."
                      defaultExpandAll
                    />
                  )}
                </Tabs.TabPane>
                <Tabs.TabPane tab="收藏" itemKey="favorites">
                  <List
                    loading={favoritesQuery.isFetching}
                    dataSource={favoritesQuery.data?.list ?? []}
                    emptyContent={<Empty description="还没有收藏的文档" />}
                    renderItem={(item) => (
                      <List.Item
                        style={{ cursor: 'pointer', padding: '8px 8px' }}
                        onClick={() => selectDoc(item.id)}
                        main={(
                          <div style={{ minWidth: 0 }}>
                            <Text ellipsis={{ showTooltip: true }} style={{ width: '100%' }}>{item.title}</Text>
                            <div><Text type="tertiary" size="small">{item.spaceName}</Text></div>
                          </div>
                        )}
                      />
                    )}
                  />
                </Tabs.TabPane>
                <Tabs.TabPane tab="最近" itemKey="recent">
                  <List
                    loading={recentQuery.isFetching}
                    dataSource={recentQuery.data ?? []}
                    emptyContent={<Empty description="还没有浏览记录" />}
                    renderItem={(item) => (
                      <List.Item
                        style={{ cursor: 'pointer', padding: '8px 8px' }}
                        onClick={() => selectDoc(item.id)}
                        main={(
                          <div style={{ minWidth: 0 }}>
                            <Text ellipsis={{ showTooltip: true }} style={{ width: '100%' }}>{item.title}</Text>
                            <div><Text type="tertiary" size="small">{item.spaceName}</Text></div>
                          </div>
                        )}
                      />
                    )}
                  />
                </Tabs.TabPane>
                <Tabs.TabPane tab="我的" itemKey="mine">
                  <List
                    loading={myDocsQuery.isFetching}
                    dataSource={myDocsQuery.data?.list ?? []}
                    emptyContent={<Empty description="还没有创建过文档" />}
                    renderItem={(item) => (
                      <List.Item
                        style={{ cursor: 'pointer', padding: '8px 8px' }}
                        onClick={() => selectDoc(item.id)}
                        main={(
                          <div style={{ minWidth: 0 }}>
                            <Space spacing={4}>
                              <Text ellipsis={{ showTooltip: true }}>{item.title}</Text>
                              <Tag size="small" color={STATUS_TAG_COLOR[item.status]}>{WIKI_DOC_STATUS_LABELS[item.status]}</Tag>
                            </Space>
                            <div><Text type="tertiary" size="small">{item.spaceName} · {item.updatedAt}</Text></div>
                          </div>
                        )}
                      />
                    )}
                  />
                </Tabs.TabPane>
                <Tabs.TabPane tab="搜索" itemKey="search">
                  <div style={{ padding: '4px 0 8px' }}>
                    <KeywordInput
                      placeholder="搜索标题、摘要、正文..."
                      style={{ width: '100%' }}
                      value={searchDraft}
                      onChange={setSearchDraft}
                      onSearch={() => setSearchKeyword(searchDraft.trim())}
                    />
                  </div>
                  {searchKeyword === '' ? (
                    <Empty description="输入关键词后回车检索全部可访问空间" style={{ marginTop: 32 }} />
                  ) : (
                    <List
                      loading={searchQuery.isFetching}
                      dataSource={searchQuery.data?.list ?? []}
                      emptyContent={<Empty description={`没有找到与「${searchKeyword}」相关的文档`} />}
                      renderItem={(item) => (
                        <List.Item
                          style={{ cursor: 'pointer', padding: '8px 8px' }}
                          onClick={() => selectSearchResult(item.id)}
                          main={(
                            <div style={{ minWidth: 0 }}>
                              <Text ellipsis={{ showTooltip: true }} style={{ width: '100%' }}>{item.title}</Text>
                              {item.snippet ? (
                                <Text type="tertiary" size="small" ellipsis={{ rows: 2 }} style={{ width: '100%' }}>
                                  {item.snippet}
                                </Text>
                              ) : null}
                              <div><Text type="quaternary" size="small">{item.spaceName}</Text></div>
                            </div>
                          )}
                        />
                      )}
                    />
                  )}
                </Tabs.TabPane>
              </Tabs>
            </MasterDetailLayout.Body>
          </>
        )}
        detail={(
          <MasterDetailLayout.Body padding="0 0 0 16px">
            {detailContent}
          </MasterDetailLayout.Body>
        )}
      />

      {/* 移动文档弹窗 */}
      <AppModal
        title={`移动「${moveTarget?.title ?? ''}」`}
        visible={!!moveTarget}
        closeOnEsc
        width={480}
        onCancel={() => setMoveTarget(null)}
        onOk={() => {
          if (!moveTarget) return;
          moveMutation.mutate(
            { id: moveTarget.id, parentId: moveParentId },
            { onSuccess: () => { Toast.success('移动成功'); setMoveTarget(null); } },
          );
        }}
        okButtonProps={{ loading: moveMutation.isPending }}
      >
        <TreeSelect
          style={{ width: '100%' }}
          placeholder="选择目标父文档，留空则移动到根级"
          treeData={toMoveTreeData(treeQuery.data ?? [], moveTarget?.id ?? -1)}
          value={moveParentId ?? undefined}
          onChange={(v) => setMoveParentId(v === undefined ? null : Number(v))}
          showClear
          filterTreeNode
        />
      </AppModal>

      {/* 阅读确认名单弹窗 */}
      <AppModal
        title="阅读确认情况"
        visible={receiptsVisible}
        closeOnEsc
        width={520}
        footer={null}
        onCancel={() => setReceiptsVisible(false)}
      >
        <Spin spinning={receiptsQuery.isFetching}>
          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            <Text strong>已确认（{receiptsQuery.data?.confirmed.length ?? 0}）</Text>
            <div style={{ margin: '8px 0 16px' }}>
              {(receiptsQuery.data?.confirmed ?? []).map((r) => (
                <div key={r.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text>{r.nickname}</Text>
                  <Text type="tertiary" size="small">{r.confirmedAt}</Text>
                </div>
              ))}
              {receiptsQuery.data?.confirmed.length === 0 ? <Text type="tertiary">还没有人确认</Text> : null}
            </div>
            <Text strong>未确认（{receiptsQuery.data?.unconfirmed.length ?? 0}）</Text>
            <div style={{ marginTop: 8 }}>
              {(receiptsQuery.data?.unconfirmed ?? []).map((r) => (
                <Tag key={r.userId} size="small" style={{ margin: '0 6px 6px 0' }}>{r.nickname}</Tag>
              ))}
              {receiptsQuery.data?.unconfirmed.length === 0 ? <Text type="tertiary">空间成员均已确认</Text> : null}
            </div>
          </div>
        </Spin>
      </AppModal>
    </div>
  );
}
