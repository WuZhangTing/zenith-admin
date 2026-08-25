const DOT_BASE: React.CSSProperties = {
  position: 'absolute', insetInlineEnd: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%',
  border: '2px solid var(--semi-color-bg-1)', boxSizing: 'border-box',
};

/**
 * 给头像叠加在线状态点：在线绿 / 离线灰（与用户管理页双态语义一致）。
 * 状态点不适用的场景（如频道官方徽标占位）传 showOffline={false} 保持离线时无点。
 */
export function PresenceAvatar({ online, showOffline = true, children }: Readonly<{
  online: boolean;
  /** 离线时是否显示灰点（默认显示） */
  showOffline?: boolean;
  children: React.ReactNode;
}>) {
  const visible = online || showOffline;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {children}
      {visible && (
        <span
          title={online ? '在线' : '离线'}
          style={{ ...DOT_BASE, background: online ? 'var(--semi-color-success)' : 'var(--semi-color-fill-2)' }}
        />
      )}
    </span>
  );
}
