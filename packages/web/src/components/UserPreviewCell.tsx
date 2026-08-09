import { useEffect, useState } from 'react';
import { Avatar, AvatarGroup, Empty, Modal, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { ConfigurableTable } from '@/components/ConfigurableTable';
import { KeywordInput } from '@/components/search-filters';
import { usePagination } from '@/hooks/usePagination';
import { useScopeMembers, type ScopeMember, type UserScopeType } from '@/hooks/queries/scope-members';

export interface UserPreviewItem {
  id: number;
  nickname: string;
  avatar?: string | null;
}

/** 成员归属：给定后单元格可点击，弹窗展示该范围内的完整成员名单 */
export interface UserPreviewScope {
  type: UserScopeType;
  id: number;
  /** 弹窗标题里的对象名，如部门名 / 角色名 */
  name: string;
}

interface UserPreviewCellProps {
  /** 预览成员列表（最多展示 4 个头像） */
  readonly preview?: UserPreviewItem[] | null;
  /** 成员总数（为 0 时仅显示数量 Tag） */
  readonly count?: number | null;
  /**
   * 成员归属范围。传入后单元格变为可点击并弹出成员名单；不传则退化为纯展示。
   * 四个来源的查询接口都用各自页面的 `:list` 权限守卫，
   * 即「能看见这个列表页就能看这一列的成员」，调用方无需再做权限判断。
   */
  readonly scope?: UserPreviewScope;
}

const SCOPE_LABEL: Record<UserScopeType, string> = {
  department: '部门',
  role: '角色',
  position: '岗位',
  userGroup: '用户组',
};

/** 表格「成员 / 用户」列单元格：头像组 + 数量 Tag，Departments / Roles / Positions / UserGroups 等列表页共用 */
export function UserPreviewCell({ preview, count, scope }: UserPreviewCellProps) {
  const [open, setOpen] = useState(false);
  const list = preview ?? [];
  const total = count ?? 0;

  if (total === 0) return <Tag color="blue">0</Tag>;

  const content = (
    <Space spacing={6}>
      <AvatarGroup maxCount={4} size="extra-extra-small" overlapFrom="end">
        {list.map((m) => (
          <Avatar
            key={m.id}
            style={{ width: 22, height: 22, minWidth: 22, lineHeight: '22px', fontSize: 12, cursor: 'inherit' }}
            src={m.avatar ?? undefined}
            alt={m.nickname}
            color="light-blue"
            title={m.nickname}
          >
            {m.nickname?.[0]}
          </Avatar>
        ))}
      </AvatarGroup>
      <Tag color="blue" style={{ flexShrink: 0 }}>{total}</Tag>
    </Space>
  );

  // 不传 scope 时退化为纯展示，保持既有调用方（若有）不受影响
  if (!scope) return content;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`查看${SCOPE_LABEL[scope.type]}「${scope.name}」的 ${total} 名成员`}
        style={{
          display: 'inline-flex', alignItems: 'center', padding: 0, border: 'none',
          background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit',
        }}
      >
        {content}
      </button>
      {/* 弹窗按需挂载：不展开就不发请求，列表有几十行也不会打出几十个查询 */}
      {open && <ScopeMemberModal scope={scope} total={total} onClose={() => setOpen(false)} />}
    </>
  );
}

interface ScopeMemberModalProps {
  readonly scope: UserPreviewScope;
  readonly total: number;
  readonly onClose: () => void;
}

function ScopeMemberModal({ scope, total, onClose }: ScopeMemberModalProps) {
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const { page, pageSize, resetPage, buildPagination } = usePagination();
  const query = useScopeMembers(scope.type, scope.id, { page, pageSize, keyword: keyword || undefined });
  const data = query.data;

  /*
    输入即搜（300ms 防抖）而非回车触发：
    KeywordInput 带 showClear，点 × 只会清空输入框，不会触发一次「回车搜索」——
    用户以为清掉了筛选，列表却仍停在上一次的过滤结果。以 draft 为唯一输入源就没有这个缝隙。
    搜索必须重置页码：停在第 3 页搜一个只有 2 条结果的关键字会落到空页。
  */
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = keywordDraft.trim();
      setKeyword((prev) => {
        if (prev === next) return prev;
        resetPage();
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [keywordDraft, resetPage]);

  return (
    <Modal
      title={`${SCOPE_LABEL[scope.type]}「${scope.name}」成员`}
      visible
      onCancel={onClose}
      footer={null}
      width={640}
      closeOnEsc
    >
      <Space style={{ width: '100%', marginBottom: 12 }}>
        <KeywordInput
          placeholder="搜索昵称 / 用户名"
          value={keywordDraft}
          onChange={setKeywordDraft}
        />
        <Typography.Text type="tertiary" size="small">共 {total} 人</Typography.Text>
      </Space>
      {data && data.total === 0 && keyword ? (
        <Empty description={`没有匹配「${keyword}」的成员`} />
      ) : (
        <ConfigurableTable<ScopeMember>
          bordered
          rowKey="id"
          loading={query.isFetching}
          dataSource={data?.list ?? []}
          pagination={buildPagination(data?.total ?? 0)}
          onRefresh={() => void query.refetch()}
          refreshLoading={query.isFetching}
          empty="暂无成员"
          columns={[
            {
              title: '成员',
              dataIndex: 'nickname',
              render: (_value: unknown, record: ScopeMember) => (
                <Space spacing={8}>
                  <Avatar size="extra-extra-small" src={record.avatar ?? undefined} color="light-blue" alt={record.nickname}>
                    {record.nickname?.[0]}
                  </Avatar>
                  <Typography.Text>{record.nickname}</Typography.Text>
                </Space>
              ),
            },
            {
              title: '用户名',
              dataIndex: 'username',
              width: 200,
              render: (value: string) => <Typography.Text type="tertiary">{value}</Typography.Text>,
            },
          ]}
        />
      )}
    </Modal>
  );
}
