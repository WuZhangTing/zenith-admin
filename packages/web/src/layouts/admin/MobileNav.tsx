import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Nav, SideSheet } from '@douyinfe/semi-ui';
import { Menu as MenuIcon } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { config } from '@/config';
import type { NavItem } from './utils';

// 移动端顶栏（汉堡菜单 + 品牌 + 头部操作区）
export function MobileHeader({
  setMobileNavVisible,
  navigateHome,
  handleNavigateHomeKey,
  mobileHeaderTitle,
  headerActions,
}: Readonly<{
  setMobileNavVisible: Dispatch<SetStateAction<boolean>>;
  navigateHome: () => void;
  handleNavigateHomeKey: (e: React.KeyboardEvent) => void;
  mobileHeaderTitle: string;
  headerActions: ReactNode;
}>) {
  return (
    <header className="admin-mobile-header">
      <button
        type="button"
        className="admin-mobile-header__menu"
        aria-label="打开导航菜单"
        onClick={() => setMobileNavVisible(true)}
      >
        <MenuIcon size={20} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="admin-mobile-header__brand"
        onClick={navigateHome}
        onKeyDown={handleNavigateHomeKey}
      >
        <AppLogo size={26} />
        <span className="admin-mobile-header__title">{mobileHeaderTitle}</span>
      </button>
      {headerActions}
    </header>
  );
}

// 移动端抽屉导航
export function MobileNavSheet({
  mobileNavVisible,
  setMobileNavVisible,
  navigateHome,
  handleNavigateHomeKey,
  navItems,
  currentSelectedKeys,
  openKeys,
  handleSidebarOpenChange,
  renderMobileWrapper,
}: Readonly<{
  mobileNavVisible: boolean;
  setMobileNavVisible: Dispatch<SetStateAction<boolean>>;
  navigateHome: () => void;
  handleNavigateHomeKey: (e: React.KeyboardEvent) => void;
  navItems: NavItem[];
  currentSelectedKeys: string[];
  openKeys: string[];
  handleSidebarOpenChange: (data: { openKeys?: (string | number)[] }) => void;
  renderMobileWrapper: (args: { itemElement: React.ReactNode; props: { itemKey?: string | number } }) => React.ReactNode;
}>) {
  return (
    <SideSheet
      className="admin-mobile-nav-sheet"
      title={
        <button
          type="button"
          className="admin-mobile-nav-sheet__brand"
          onClick={() => {
            setMobileNavVisible(false);
            navigateHome();
          }}
          onKeyDown={handleNavigateHomeKey}
        >
          <AppLogo size={26} />
          <span>{config.appTitle}</span>
        </button>
      }
      visible={mobileNavVisible}
      onCancel={() => setMobileNavVisible(false)}
      placement="left"
      width="min(86vw, 320px)"
      bodyStyle={{ padding: 0 }}
    >
      <Nav
        className="admin-mobile-nav"
        mode="vertical"
        items={navItems}
        selectedKeys={currentSelectedKeys}
        openKeys={openKeys}
        onOpenChange={handleSidebarOpenChange}
        renderWrapper={renderMobileWrapper}
      />
    </SideSheet>
  );
}
