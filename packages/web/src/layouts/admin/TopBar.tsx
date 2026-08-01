import type { ReactNode } from 'react';
import AppLogo from '@/components/AppLogo';
import { config } from '@/config';
import type { NavLayout } from '@/hooks/usePreferences';
import { TopNavWithOverflow } from '../TopNavWithOverflow';
import type { NavItem } from './utils';

// Top bar for horizontal and mixed layouts
export function TopBar({
  showLogo,
  navigateHome,
  handleNavigateHomeKey,
  navLayout,
  mixedTopNavItems,
  navItems,
  topNavSelectedKeys,
  renderWrapper,
  handleMixedTopSelect,
  headerActions,
}: Readonly<{
  showLogo: boolean;
  navigateHome: () => void;
  handleNavigateHomeKey: (e: React.KeyboardEvent) => void;
  navLayout: NavLayout;
  mixedTopNavItems: Pick<NavItem, 'itemKey' | 'text' | 'icon' | 'isExternal'>[];
  navItems: NavItem[];
  topNavSelectedKeys: string[];
  renderWrapper: (args: { itemElement: React.ReactNode; props: { itemKey?: string | number } }) => React.ReactNode;
  handleMixedTopSelect: (data: { itemKey: string | number }) => void;
  headerActions: ReactNode;
}>) {
  return (
    <header className="admin-topbar">
      {showLogo && (
        <button
          type="button"
          className="admin-topbar__brand"
          style={{ cursor: 'pointer', background: 'transparent', border: 0, padding: 0, font: 'inherit', color: 'inherit' }}
          onClick={navigateHome}
          onKeyDown={handleNavigateHomeKey}
        >
          <AppLogo size={28} />
          <span className="admin-sidebar__title">{config.appTitle}</span>
        </button>
      )}
      <TopNavWithOverflow
        className="admin-topbar__nav"
        ariaLabel={navLayout === 'mixed' ? '分类导航' : '主导航'}
        items={navLayout === 'mixed' ? mixedTopNavItems : navItems}
        selectedKeys={topNavSelectedKeys}
        renderWrapper={renderWrapper}
        onItemClick={navLayout === 'mixed' ? (key) => handleMixedTopSelect({ itemKey: key }) : undefined}
      />
      {headerActions}
    </header>
  );
}
