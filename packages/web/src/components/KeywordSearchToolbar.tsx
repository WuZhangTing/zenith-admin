import type { ReactNode } from 'react';
import { SearchToolbar } from './SearchToolbar';
import { KeywordInput } from '@/components/search-filters';
import { ResetButton, SearchButton } from '@/components/toolbar-controls';

interface KeywordSearchToolbarProps {
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** 点击「查询」按钮或输入框回车时触发 */
  readonly onSearch: () => void;
  /** 点击「重置」按钮时触发 */
  readonly onReset: () => void;
  /** 输入框宽度，默认 220 */
  readonly width?: number;
  /** 桌面端「重置」之后的附加操作按钮（移动端收进更多菜单） */
  readonly actions?: ReactNode;
}

/**
 * 仅含「关键字输入 + 查询 + 重置（+ 可选操作按钮）」的标准搜索工具栏。
 * 桌面端平铺展示；移动端露出输入框和查询按钮，重置与附加操作收进更多菜单。
 */
export function KeywordSearchToolbar({ placeholder, value, onChange, onSearch, onReset, width = 220, actions }: KeywordSearchToolbarProps) {
  const keywordInput = (
    <KeywordInput placeholder={placeholder} value={value} onChange={onChange} onSearch={onSearch} width={width} />
  );
  const searchButton = <SearchButton onClick={onSearch} />;
  const resetButton = <ResetButton onClick={onReset} />;

  return (
    <SearchToolbar
      primary={(
        <>
          {keywordInput}
          {searchButton}
          {resetButton}
          {actions}
        </>
      )}
      mobilePrimary={(
        <>
          {keywordInput}
          {searchButton}
        </>
      )}
      mobileActions={(
        <>
          {resetButton}
          {actions}
        </>
      )}
    />
  );
}
