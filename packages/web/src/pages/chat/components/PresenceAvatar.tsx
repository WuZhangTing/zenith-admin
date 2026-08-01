const ONLINE_DOT_STYLE: React.CSSProperties = {
  position: 'absolute', insetInlineEnd: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%',
  background: 'var(--semi-color-success)', border: '2px solid var(--semi-color-bg-1)', boxSizing: 'border-box',
};

/** 给头像叠加在线小绿点 */
export function PresenceAvatar({ online, children }: Readonly<{ online: boolean; children: React.ReactNode }>) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {children}
      {online && <span style={ONLINE_DOT_STYLE} />}
    </span>
  );
}
