import { Button } from '@douyinfe/semi-ui';
import { Clock, X } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import type { FlatMenuItem } from '@/components/MenuSearchInput';
import type { TabItem } from '@/hooks/useTabsStore';
import { renderLucideIcon } from '@/utils/icons';

// 移动端「页面」下拉面板：已打开页签 + 最近访问
export function MobileQuickPagesPanel({
  tabs,
  activeKey,
  pathIconMap,
  recentMenus,
  setMobilePagesVisible,
  handleTabChange,
  handleTabClose,
  clearRecents,
  removeRecent,
  navigate,
}: Readonly<{
  tabs: TabItem[];
  activeKey: string;
  pathIconMap: Record<string, string>;
  recentMenus: FlatMenuItem[];
  setMobilePagesVisible: (visible: boolean) => void;
  handleTabChange: (key: string) => void;
  handleTabClose: (key: string) => void;
  clearRecents: () => void;
  removeRecent: (id: number) => void;
  navigate: NavigateFunction;
}>) {
  return (
    <div className="mobile-quick-pages-panel">
      <div className="mobile-quick-pages-section">
        <div className="mobile-quick-pages-section__header">
          <span>已打开页面</span>
          <span>{tabs.length}</span>
        </div>
        {tabs.length === 0 ? (
          <div className="mobile-quick-pages-empty">暂无打开页面</div>
        ) : (
          <div className="mobile-quick-pages-list">
            {tabs.map((tab) => {
              const isActive = tab.key === activeKey;
              const iconName = tab.icon ?? pathIconMap[tab.key];
              return (
                <div key={tab.key} className={`mobile-quick-pages-item${isActive ? ' mobile-quick-pages-item--active' : ''}`}>
                  <button
                    type="button"
                    className="mobile-quick-pages-item__main"
                    onClick={() => {
                      setMobilePagesVisible(false);
                      handleTabChange(tab.key);
                    }}
                  >
                    {iconName && (
                      <span className="mobile-quick-pages-item__icon">{renderLucideIcon(iconName, 14)}</span>
                    )}
                    <span className="mobile-quick-pages-item__title">{tab.title}</span>
                  </button>
                  {tab.closable && (
                    <Button
                      icon={<X size={13} />}
                      theme="borderless"
                      type="tertiary"
                      size="small"
                      aria-label={`关闭${tab.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTabClose(tab.key);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mobile-quick-pages-section">
        <div className="mobile-quick-pages-section__header">
          <span>最近访问</span>
          {recentMenus.length > 0 && (
            <button type="button" onClick={clearRecents}>清空</button>
          )}
        </div>
        {recentMenus.length === 0 ? (
          <div className="mobile-quick-pages-empty">暂无记录</div>
        ) : (
          <div className="mobile-quick-pages-list">
            {recentMenus.map((menu) => (
              <div key={menu.id} className="mobile-quick-pages-item">
                <button
                  type="button"
                  className="mobile-quick-pages-item__main"
                  onClick={() => {
                    setMobilePagesVisible(false);
                    navigate(menu.path);
                  }}
                >
                  <span className="mobile-quick-pages-item__icon"><Clock size={14} /></span>
                  <span className="mobile-quick-pages-item__title">{menu.title}</span>
                  <span className="mobile-quick-pages-item__meta">{menu.breadcrumb.at(-1) ?? ''}</span>
                </button>
                <Button
                  icon={<X size={13} />}
                  theme="borderless"
                  type="tertiary"
                  size="small"
                  aria-label={`移除${menu.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecent(menu.id);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
