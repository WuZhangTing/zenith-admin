/**
 * 列表页搜索工具栏的标准按钮。
 *
 * 「查询 / 重置 / 新增」三个按钮在 140+ 个列表页里逐字复制了同一段 JSX
 * （type、icon、图标尺寸、文案全都一样），改一次样式就得改几百处。
 * 这里收敛为组件，配合 `SearchToolbar` 使用：
 *
 * @example
 * <SearchToolbar
 *   primary={<>{renderKeyword()}<SearchButton onClick={handleSearch} /><ResetButton onClick={handleReset} /></>}
 *   actions={hasPermission('system:role:create') ? <CreateButton onClick={openCreate} /> : null}
 * />
 */
import type { ReactNode } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { Plus, RotateCcw, Search } from 'lucide-react';

interface ToolbarButtonProps {
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  /** 覆盖默认文案（如「新增角色」「查询日志」） */
  readonly children?: ReactNode;
}

/** 主查询按钮（primary + 放大镜图标） */
export function SearchButton({ onClick, disabled, loading, children = '查询' }: ToolbarButtonProps) {
  return (
    <Button type="primary" icon={<Search size={14} />} onClick={onClick} disabled={disabled} loading={loading}>
      {children}
    </Button>
  );
}

/** 条件重置按钮（tertiary + 回退图标） */
export function ResetButton({ onClick, disabled, loading, children = '重置' }: ToolbarButtonProps) {
  return (
    <Button type="tertiary" icon={<RotateCcw size={14} />} onClick={onClick} disabled={disabled} loading={loading}>
      {children}
    </Button>
  );
}

/**
 * 列表刷新按钮：与 `ResetButton` 视觉一致，但语义是「重新拉取数据」而非「清空筛选条件」。
 * 单独成组件，避免二者被同一次样式改动误伤。
 */
export function RefreshButton({ onClick, disabled, loading, children = '刷新' }: ToolbarButtonProps) {
  return (
    <Button type="tertiary" icon={<RotateCcw size={14} />} onClick={onClick} disabled={disabled} loading={loading}>
      {children}
    </Button>
  );
}

/** 新增按钮（primary + 加号图标）；是否渲染由调用方按权限判断 */
export function CreateButton({ onClick, disabled, loading, children = '新增' }: ToolbarButtonProps) {
  return (
    <Button type="primary" icon={<Plus size={14} />} onClick={onClick} disabled={disabled} loading={loading}>
      {children}
    </Button>
  );
}
