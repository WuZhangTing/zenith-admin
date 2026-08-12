import { useMemo } from 'react';
import { Select } from '@douyinfe/semi-ui';
import { useAlertRecipientUsers } from '@/hooks/queries/users';

interface AlertRecipientUserSelectProps {
  value?: number[];
  onChange?: (value: number[] | undefined) => void;
  disabled?: boolean;
}

export default function AlertRecipientUserSelect({
  value,
  onChange,
  disabled = false,
}: Readonly<AlertRecipientUserSelectProps>) {
  const usersQuery = useAlertRecipientUsers();
  const optionList = useMemo(
    () => (usersQuery.data ?? []).map((user) => {
      const details = [
        user.username,
        user.departmentName,
        user.hasEmail ? '已配置邮箱' : '无邮箱',
      ].filter(Boolean);
      return {
        value: user.id,
        label: `${user.nickname}（${details.join(' · ')}）`,
      };
    }),
    [usersQuery.data],
  );
  const usersById = useMemo(
    () => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
    [usersQuery.data],
  );
  const placeholder = usersQuery.isPending
    ? '加载接收用户...'
    : usersQuery.isError
      ? '接收用户加载失败，请稍后重试'
      : '请选择接收用户';

  return (
    <Select
      value={value}
      onChange={(nextValue) => onChange?.(nextValue as number[] | undefined)}
      multiple
      filter
      showClear
      maxTagCount={3}
      disabled={disabled || usersQuery.isPending || usersQuery.isError}
      placeholder={placeholder}
      optionList={optionList}
      emptyContent="暂无可用的启用用户"
      renderSelectedItem={(option: { value?: unknown; label?: unknown }) =>
        usersById.get(Number(option.value))?.nickname ?? String(option.label ?? '')}
      style={{ width: '100%' }}
    />
  );
}
