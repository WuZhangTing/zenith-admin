import { useMemo, useState } from 'react';
import { Button, Dropdown, Input, Modal, Table, Tag, Tree, Typography } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import type { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree/interface';
import { ChevronDown, Link2, Search } from 'lucide-react';
import {
  buildCmsEntityLink, parseCmsLink, CMS_CONTENT_STATUS_LABELS, CMS_CONTENT_TYPE_LABELS,
} from '@zenith/shared';
import type { CmsChannel, CmsContent } from '@zenith/shared';
import { useCmsChannelTree, useCmsContentList, useCmsLinkTarget } from '@/hooks/queries/cms';

type PickerMode = 'content' | 'channel' | null;

function channelsToTree(nodes: CmsChannel[]): TreeNodeData[] {
  return nodes.map((n) => ({
    key: String(n.id),
    value: n.id,
    label: n.name,
    children: n.children ? channelsToTree(n.children) : undefined,
  }));
}

/** 内容选择弹窗：按关键词检索本站内容 */
function ContentPickerModal({ siteId, visible, onCancel, onSelect, excludeId }: Readonly<{
  siteId: number | undefined;
  visible: boolean;
  onCancel: () => void;
  onSelect: (content: CmsContent) => void;
  excludeId?: number;
}>) {
  const [draftKeyword, setDraftKeyword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const listQuery = useCmsContentList(
    { page, pageSize, siteId: siteId ?? 0, keyword: keyword || undefined },
    visible && siteId !== undefined,
  );
  const rows = (listQuery.data?.list ?? []).filter((c) => c.id !== excludeId);

  const columns: ColumnProps<CmsContent>[] = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '形态', dataIndex: 'contentType', width: 88,
      render: (v: CmsContent['contentType']) => CMS_CONTENT_TYPE_LABELS[v],
    },
    {
      title: '状态', dataIndex: 'status', width: 88,
      render: (v: CmsContent['status']) => CMS_CONTENT_STATUS_LABELS[v],
    },
    {
      title: '操作', width: 72, fixed: 'right',
      render: (_: unknown, record: CmsContent) => (
        <Button theme="borderless" size="small" onClick={() => onSelect(record)}>选择</Button>
      ),
    },
  ];

  return (
    <Modal title="选择内容" visible={visible} onCancel={onCancel} footer={null} width={720} closeOnEsc>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Input
          prefix={<Search size={14} />}
          placeholder="搜索标题"
          value={draftKeyword}
          onChange={setDraftKeyword}
          onEnterPress={() => { setKeyword(draftKeyword); setPage(1); }}
          showClear
        />
        <Button type="primary" onClick={() => { setKeyword(draftKeyword); setPage(1); }}>查询</Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={listQuery.isFetching}
        pagination={{
          currentPage: page,
          pageSize,
          total: listQuery.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </Modal>
  );
}

/** 栏目选择弹窗 */
function ChannelPickerModal({ siteId, visible, onCancel, onSelect, excludeId }: Readonly<{
  siteId: number | undefined;
  visible: boolean;
  onCancel: () => void;
  onSelect: (channelId: number) => void;
  excludeId?: number;
}>) {
  const treeQuery = useCmsChannelTree(siteId);
  const treeData = useMemo(() => channelsToTree(treeQuery.data ?? []), [treeQuery.data]);

  return (
    <Modal title="选择栏目" visible={visible} onCancel={onCancel} footer={null} width={480} closeOnEsc>
      <Tree
        treeData={treeData}
        filterTreeNode
        searchPlaceholder="搜索栏目"
        style={{ maxHeight: 420, overflow: 'auto' }}
        onSelect={(key) => {
          const id = Number(key);
          if (id !== excludeId) onSelect(id);
        }}
      />
    </Modal>
  );
}

/**
 * 链接字段的「内部链接」选择能力。
 *
 * 刻意做成 hook 而非独立受控组件：链接字段本身仍由 `Form.Input` 承载，
 * 校验、脏值追踪、表单重置全部交给 Semi Form，这里只补三块 UI ——
 * 输入框右侧的选择器、下方的目标回显、以及两个选择弹窗。
 *
 * 存储值遵循 `packages/shared/src/cms-link.ts` 的协议：
 * `entity:content/123` / `entity:channel/45` / `internal:/path` / `https://…`
 */
export function useCmsLinkPicker({
  siteId, value, onPick, disabled, excludeContentId, excludeChannelId,
}: Readonly<{
  siteId: number | undefined;
  /** 当前链接值，用于回显解析结果 */
  value: string | null | undefined;
  onPick: (next: string) => void;
  disabled?: boolean;
  /** 编辑自身时排除，避免选到自己形成跳转死循环 */
  excludeContentId?: number;
  excludeChannelId?: number;
}>) {
  const [picker, setPicker] = useState<PickerMode>(null);
  const raw = value?.trim() ?? '';
  const ref = parseCmsLink(raw);
  const targetQuery = useCmsLinkTarget(siteId, raw);

  const hintText = ((): { text: string; danger: boolean } | null => {
    if (!raw) return null;
    if (!ref) return { text: '链接格式不合法', danger: true };
    if (ref.kind === 'internal') return { text: `站内路径：${ref.path}`, danger: false };
    if (ref.kind !== 'entity') return null;
    if (targetQuery.isFetching) return { text: '解析中…', danger: false };
    const target = targetQuery.data;
    if (!target) return { text: '目标解析失败', danger: true };
    const typeLabel = target.kind === 'entity-channel' ? '栏目' : '内容';
    return target.exists
      ? { text: `站内${typeLabel}：${target.label}`, danger: false }
      : { text: `${target.label}，链接已失效`, danger: true };
  })();

  const suffix = (
    <Dropdown
      trigger="click"
      position="bottomRight"
      clickToHide
      render={(
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => setPicker('content')}>选择内容</Dropdown.Item>
          <Dropdown.Item onClick={() => setPicker('channel')}>选择栏目</Dropdown.Item>
        </Dropdown.Menu>
      )}
    >
      <Button size="small" theme="borderless" disabled={disabled || siteId === undefined} icon={<Link2 size={14} />}>
        内部链接<ChevronDown size={12} style={{ marginLeft: 2 }} />
      </Button>
    </Dropdown>
  );

  const hint = hintText ? (
    <div style={{ marginTop: -8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      {ref?.kind === 'entity' ? <Tag size="small" color="blue">内部链接</Tag> : null}
      <Typography.Text type={hintText.danger ? 'danger' : 'tertiary'} size="small">{hintText.text}</Typography.Text>
    </div>
  ) : null;

  const modals = (
    <>
      <ContentPickerModal
        siteId={siteId}
        visible={picker === 'content'}
        excludeId={excludeContentId}
        onCancel={() => setPicker(null)}
        onSelect={(content) => { onPick(buildCmsEntityLink('content', content.id)); setPicker(null); }}
      />
      <ChannelPickerModal
        siteId={siteId}
        visible={picker === 'channel'}
        excludeId={excludeChannelId}
        onCancel={() => setPicker(null)}
        onSelect={(channelId) => { onPick(buildCmsEntityLink('channel', channelId)); setPicker(null); }}
      />
    </>
  );

  return { suffix, hint, modals };
}
