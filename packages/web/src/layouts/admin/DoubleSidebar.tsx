import { Badge, Nav, Tooltip } from '@douyinfe/semi-ui';
import AppLogo from '@/components/AppLogo';
import type { NavItem } from './utils';

// 双列侧边栏（double 布局）：左侧图标栏 + 右侧子导航
export function DoubleSidebar({
  doubleSubItems,
  stickyNavClass,
  showLogo,
  navigateHome,
  handleNavigateHomeKey,
  navItems,
  effectiveTopKey,
  handleDoubleRailClick,
  currentSelectedKeys,
  openKeys,
  handleSidebarOpenChange,
  renderWrapper,
}: Readonly<{
  doubleSubItems: NavItem[];
  stickyNavClass: string;
  showLogo: boolean;
  navigateHome: () => void;
  handleNavigateHomeKey: (e: React.KeyboardEvent) => void;
  navItems: NavItem[];
  effectiveTopKey: string | null;
  handleDoubleRailClick: (item: NavItem) => void;
  currentSelectedKeys: string[];
  openKeys: string[];
  handleSidebarOpenChange: (data: { openKeys?: (string | number)[] }) => void;
  renderWrapper: (args: { itemElement: React.ReactNode; props: { itemKey?: string | number } }) => React.ReactNode;
}>) {
  return (
    <aside className={`admin-sidebar admin-sidebar--double${doubleSubItems.length === 0 ? ' admin-sidebar--double-no-sub' : ''}${stickyNavClass}`}>
      {/* Left icon rail */}
      <div className="double-sidebar__rail">
        {showLogo && (
          <button
            type="button"
            className="double-sidebar__logo"
            onClick={navigateHome}
            onKeyDown={handleNavigateHomeKey}
          >
            <AppLogo size={26} />
          </button>
        )}
        <div className="double-sidebar__rail-list" role="navigation" aria-label="分组导航">
          {navItems.map((item) => {
            const isActive = effectiveTopKey === item.itemKey;
            return (
              <Tooltip key={item.itemKey} content={item.text} position="right">
                <button
                  type="button"
                  className={`double-sidebar__rail-item${isActive ? ' double-sidebar__rail-item--active' : ''}`}
                  onClick={() => handleDoubleRailClick(item)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="double-sidebar__rail-icon">
                    {item.badge && item.badge.count > 0 ? (
                      <Badge count={item.badge.count} overflowCount={item.badge.overflowCount ?? 99}>
                        {item.icon}
                      </Badge>
                    ) : item.icon}
                  </span>
                  <span className="double-sidebar__rail-label">{item.text}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
      {/* Right sub-nav */}
      <div className="double-sidebar__sub">
        {doubleSubItems.length > 0 && (
          <>
            <div className="double-sidebar__sub-title">
              {navItems.find((i) => i.itemKey === effectiveTopKey)?.text ?? ''}
            </div>
            <Nav
              className="admin-sidebar__nav double-sidebar__sub-nav"
              mode="vertical"
              items={doubleSubItems}
              style={{ height: 'calc(100% - 48px)', overflow: 'hidden' }}
              bodyStyle={{ paddingTop: 8 }}
              isCollapsed={false}
              selectedKeys={currentSelectedKeys}
              openKeys={openKeys}
              onOpenChange={handleSidebarOpenChange}
              renderWrapper={renderWrapper}
            />
          </>
        )}
      </div>
    </aside>
  );
}
