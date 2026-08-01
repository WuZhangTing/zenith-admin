import { useState } from 'react';
import { Button, Descriptions, Input, InputNumber, Select, Toast, Tag, Modal } from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { Search, ScanLine } from 'lucide-react';
import type { MemberCoupon, MemberCouponStatus } from '@zenith/shared/member';
import { MEMBER_COUPON_STATUS_LABELS } from '@zenith/shared/member';
import { usePermission } from '@/hooks/usePermission';
import { SearchToolbar } from '@/components/SearchToolbar';
import ConfigurableTable from '@/components/ConfigurableTable';
import ExportButton from '@/components/ExportButton';
import { AppModal } from '@/components/AppModal';
import { createOperationColumn } from '@/components/ResponsiveTableActions';
import { renderEllipsis } from '../../utils/table-columns';
import { memberAdminKeys, useCouponByCode, useCouponRecordList, useRedeemCoupon, useRevokeCouponRecord } from '@/hooks/queries/member-admin';
import { useListSearch } from '@/hooks/useListSearch';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';

const statusOptions = (Object.keys(MEMBER_COUPON_STATUS_LABELS) as MemberCouponStatus[]).map((v) => ({ value: v, label: MEMBER_COUPON_STATUS_LABELS[v] }));
const STATUS_COLORS: Record<string, string> = { unused: 'blue', used: 'green', expired: 'grey', frozen: 'orange' };

interface SearchParams { memberKeyword?: string; couponId?: number; status?: string }

export default function CouponRecordsPage() {
  const { hasPermission } = usePermission();
  const {
    page, pageSize, buildPagination,
    draftParams, setDraftParams, submittedParams,
    handleSearch, handleReset,
  } = useListSearch<SearchParams>({ defaults: {}, listKey: memberAdminKeys.couponRecordLists });
  const listQuery = useCouponRecordList({
    page,
    pageSize,
    memberKeyword: submittedParams.memberKeyword || undefined,
    couponId: submittedParams.couponId,
    status: submittedParams.status || undefined,
  });
  const data = listQuery.data?.list ?? [];
  const total = listQuery.data?.total ?? 0;
  const revokeMutation = useRevokeCouponRecord();
  // 核销
  const [redeemVisible, setRedeemVisible] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemRemark, setRedeemRemark] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const previewQuery = useCouponByCode(previewCode, redeemVisible);
  const redeemMutation = useRedeemCoupon();
  const preview = previewQuery.data ?? null;

  const handleRevoke = async (id: number) => {
    await revokeMutation.mutateAsync(id);
    Toast.success('已作废');
  };

  const confirmRevoke = (record: MemberCoupon) => {
    Modal.confirm({
      title: '确定要作废该券码吗？',
      okButtonProps: { type: 'danger', theme: 'solid' },
      onOk: () => handleRevoke(record.id),
    });
  };

  const canRevoke = hasPermission('member:coupon:revoke');

  const openRedeem = () => {
    setRedeemCode('');
    setRedeemRemark('');
    setPreviewCode('');
    setRedeemVisible(true);
  };
  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      Toast.warning('请输入券码');
      return;
    }
    await redeemMutation.mutateAsync({ code: redeemCode.trim(), remark: redeemRemark || undefined });
    Toast.success('核销成功');
    setRedeemVisible(false);
  };

  const columns: ColumnProps<MemberCoupon>[] = [
    { title: '券码', dataIndex: 'code', width: 180, fixed: 'left', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: '会员', dataIndex: 'memberName', width: 140, render: (v?: string, r?: MemberCoupon) => v || `#${r?.memberId}` },
    { title: '优惠券', dataIndex: 'coupon', width: 160, render: (_: unknown, r: MemberCoupon) => renderEllipsis(r.coupon?.name ?? `#${r.couponId}`) },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: MemberCouponStatus) => <Tag color={STATUS_COLORS[v] as 'blue'}>{MEMBER_COUPON_STATUS_LABELS[v]}</Tag> },
    { title: '领取时间', dataIndex: 'receivedAt', width: 180 },
    { title: '使用时间', dataIndex: 'usedAt', width: 180, render: (v: string | null) => v || '-' },
    { title: '过期时间', dataIndex: 'expireAt', width: 180, render: (v: string | null) => v || '-' },
    ...(canRevoke ? [
      createOperationColumn<MemberCoupon>({
        width: 90,
        desktopInlineKeys: ['revoke'],
        actions: (record) => [
          {
            key: 'revoke',
            label: '作废',
            danger: true,
            hidden: record.status !== 'unused',
            onClick: () => confirmRevoke(record),
          },
        ],
      }),
    ] : []),
  ];

  const renderKeywordSearch = () => (
    <Input
      prefix={<Search size={14} />}
      placeholder="会员ID/昵称"
      value={draftParams.memberKeyword}
      showClear
      style={{ width: 180 }}
      onChange={(v) => setDraftParams((p) => ({ ...p, memberKeyword: v || undefined }))}
      onEnterPress={handleSearch}
    />
  );

  const renderCouponIdFilter = () => (
    <InputNumber
      placeholder="优惠券ID"
      value={draftParams.couponId}
      min={1}
      style={{ width: 120 }}
      onChange={(v) => setDraftParams((p) => ({ ...p, couponId: (v as number) || undefined }))}
    />
  );

  const renderStatusFilter = () => (
    <Select
      placeholder="全部状态"
      value={draftParams.status}
      style={{ width: 130 }}
      showClear
      onChange={(v) => setDraftParams((p) => ({ ...p, status: v as string | undefined }))}
      optionList={statusOptions}
    />
  );

  const renderSearchButton = () => <SearchButton onClick={handleSearch} />;
  const renderResetButton = () => <ResetButton onClick={handleReset} />;
  const renderRedeemButton = () => hasPermission('member:coupon:update') ? (
    <Button type="primary" icon={<ScanLine size={14} />} onClick={openRedeem}>核销券码</Button>
  ) : null;
  const buildExportQuery = () => ({
    ...(submittedParams.memberKeyword ? { memberKeyword: submittedParams.memberKeyword } : {}),
    ...(submittedParams.couponId ? { couponId: String(submittedParams.couponId) } : {}),
    ...(submittedParams.status ? { status: submittedParams.status } : {}),
  });
  const renderExportButton = (variant?: 'flat') => hasPermission('member:coupon:list') ? (
    <ExportButton entity="member.coupon-records" query={buildExportQuery()} variant={variant} />
  ) : null;

  return (
    <div className="page-container">
      <SearchToolbar
        primary={(
          <>
            {renderKeywordSearch()}
            {renderCouponIdFilter()}
            {renderStatusFilter()}
            {renderSearchButton()}
            {renderResetButton()}
            {renderExportButton()}
            {renderRedeemButton()}
          </>
        )}
        mobilePrimary={(
          <>
            {renderKeywordSearch()}
            {renderSearchButton()}
            {renderRedeemButton()}
          </>
        )}
        mobileFilters={(
          <>
            {renderCouponIdFilter()}
            {renderStatusFilter()}
          </>
        )}
        mobileActions={renderExportButton('flat')}
        filterTitle="领券记录筛选"
        onFilterApply={handleSearch}
        onFilterReset={handleReset}
      />

      <ConfigurableTable bordered columns={columns} dataSource={data} loading={listQuery.isFetching}
        onRefresh={() => void listQuery.refetch()} refreshLoading={listQuery.isFetching} rowKey="id" size="small"
        pagination={buildPagination(total)} empty="暂无领券记录" scroll={{ x: 1100 }} />

      {/* 核销券码 Modal */}
      <AppModal title="核销券码" visible={redeemVisible} width={520}
        okText="确认核销"
        okButtonProps={{ loading: redeemMutation.isPending, disabled: !preview || preview.status !== 'unused' }}
        onCancel={() => setRedeemVisible(false)} onOk={handleRedeem}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            prefix={<ScanLine size={14} />}
            placeholder="输入或扫码券码（CP 开头）"
            value={redeemCode}
            onChange={(v) => setRedeemCode(v.toUpperCase())}
            onEnterPress={() => setPreviewCode(redeemCode.trim())}
            style={{ flex: 1, fontFamily: 'monospace' }}
          />
          <Button onClick={() => setPreviewCode(redeemCode.trim())} loading={previewQuery.isFetching}>查询</Button>
        </div>
        {previewQuery.isError && previewCode && (
          <div style={{ color: 'var(--semi-color-danger)', fontSize: 13, marginBottom: 12 }}>券码不存在，请检查输入</div>
        )}
        {preview && (
          <div style={{ background: 'var(--semi-color-fill-0)', borderRadius: 'var(--semi-border-radius-medium)', padding: '12px 16px', marginBottom: 12 }}>
            <Descriptions size="small" row data={[
              { key: '优惠券', value: preview.coupon?.name ?? `#${preview.couponId}` },
              { key: '持有会员', value: preview.memberName ?? `#${preview.memberId}` },
              {
                key: '状态',
                value: (
                  <Tag size="small" color={(STATUS_COLORS[preview.status] ?? 'blue') as 'blue'}>
                    {MEMBER_COUPON_STATUS_LABELS[preview.status]}
                  </Tag>
                ),
              },
              { key: '有效期至', value: preview.expireAt ?? '长期有效' },
            ]} />
            {preview.status !== 'unused' && (
              <div style={{ color: 'var(--semi-color-danger)', fontSize: 13, marginTop: 8 }}>该券当前不可核销</div>
            )}
          </div>
        )}
        <Input placeholder="核销备注（选填，如订单号）" value={redeemRemark} onChange={setRedeemRemark} maxLength={128} />
      </AppModal>
    </div>
  );
}
