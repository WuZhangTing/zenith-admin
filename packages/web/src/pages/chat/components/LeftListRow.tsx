import { Badge, Typography, List as SemiList } from '@douyinfe/semi-ui';
import { BellOff, Pin, Star } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { formatConvTime } from '@/utils/date';
import type { ChatConversation } from '@zenith/shared/chat';
import type { Channel } from '@zenith/shared/messaging';
import { getMessageSummary } from '../utils';
import type { FailedMessage, GroupAvatarMap, LeftListItem, LeftPaneContextMenuState, Setter } from '../types';
import { GroupGridAvatar } from './GroupGridAvatar';
import { PresenceAvatar } from './PresenceAvatar';

const { Text } = Typography;

/** 左栏列表行：频道条目 / 会话条目（自 ChatPage renderItem 原样搬移） */
export function LeftListRow({
  item, activeChannelId, setActiveChannelId, setActiveConvId, setChannels, channelAvatarNode,
  groupAvatarMap, onlineUserIds, activeConvId, failedMessages, draftsMap, handleSelectConv,
  setLeftPaneContextMenu,
}: Readonly<{
  item: LeftListItem;
  activeChannelId: number | null;
  setActiveChannelId: Setter<number | null>;
  setActiveConvId: Setter<number | null>;
  setChannels: Setter<Channel[]>;
  channelAvatarNode: (ch: Channel) => React.ReactNode;
  groupAvatarMap: GroupAvatarMap;
  onlineUserIds: Set<number>;
  activeConvId: number | null;
  failedMessages: FailedMessage[];
  draftsMap: Record<number, string>;
  handleSelectConv: (conv: ChatConversation) => Promise<void>;
  setLeftPaneContextMenu: Setter<LeftPaneContextMenuState | null>;
}>) {
                  if (item.kind === 'channel') {
                    const ch = item.channel;
                    return (
                      <SemiList.Item
                        key={`channel-${ch.id}`}
                        align="center"
                        onClick={() => { setActiveChannelId(ch.id); setActiveConvId(null); setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, unreadCount: 0 } : c)); }}
                        style={{ padding: '10px 12px', cursor: 'pointer', background: activeChannelId === ch.id ? 'var(--semi-color-primary-light-default)' : 'transparent' }}
                        header={ch.unreadCount > 0
                          ? <Badge count={ch.unreadCount} overflowCount={99}>{channelAvatarNode(ch)}</Badge>
                          : channelAvatarNode(ch)}
                        main={(
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                              <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{ch.name}</Text>
                              {ch.lastMessage && <Text type="tertiary" style={{ fontSize: 11, flexShrink: 0 }}>{formatConvTime(ch.lastMessage.createdAt)}</Text>}
                            </div>
                            <Text type="tertiary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{ch.lastMessage ? (ch.lastMessage.title ?? ch.lastMessage.content) : (ch.description ?? '')}</Text>
                          </div>
                        )}
                      />
                    );
                  }
                  const conv = item.conv;
                  const name = conv.type === 'direct' ? (conv.targetUser?.nickname ?? '未知用户') : (conv.name ?? '群聊');
                  const avatarName = conv.type === 'direct' ? (conv.targetUser?.nickname ?? '?') : (conv.name ?? '?');
                  const avatar = conv.type === 'direct' ? conv.targetUser?.avatar : null;
                  const groupMembers = conv.type === 'group' ? groupAvatarMap[conv.id] : undefined;
                  const isTargetOnline = conv.type === 'direct' && conv.targetUser ? onlineUserIds.has(conv.targetUser.id) : false;
                  const avatarNode = conv.type === 'group'
                    ? <GroupGridAvatar name={avatarName} size={38} members={groupMembers} />
                    : <PresenceAvatar online={isTargetOnline}><UserAvatar name={avatarName} avatar={avatar} size={38} /></PresenceAvatar>;
                  const lastMsg = conv.lastMessage;
                  const isActive = conv.id === activeConvId;
                  const isPinned = conv.isPinned ?? false;
                  const isStarred = conv.isStarred ?? false;
                  const isMuted = conv.isMuted ?? false;
                  const hasMentionUnread = conv.hasMentionUnread ?? false;
                  const hasFailedMsg = failedMessages.some((m) => m.convId === conv.id);
                  const draftText = isActive ? '' : (draftsMap[conv.id] ?? '');
                  const hasDraft = draftText.trim().length > 0;
                  let lastMsgText = '暂无消息';
                  if (lastMsg) {
                    const summary = getMessageSummary(lastMsg);
                    if (conv.type === 'group' && lastMsg.senderName && lastMsg.type !== 'system' && !lastMsg.isRecalled) {
                      lastMsgText = `${lastMsg.senderName}：${summary}`;
                    } else {
                      lastMsgText = summary;
                    }
                  }

                  return (
                    <SemiList.Item
                      key={conv.id}
                      align="center"
                      onClick={() => { void handleSelectConv(conv); }}
                      onRightClick={(e) => {
                        e.preventDefault();
                        setLeftPaneContextMenu({ x: e.clientX, y: e.clientY, type: 'conversation', conv });
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: isActive ? 'var(--semi-color-primary-light-default)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--semi-color-fill-0)'; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      header={conv.unreadCount > 0 ? (
                        <Badge count={conv.unreadCount} overflowCount={99} dot={false}>
                          {avatarNode}
                        </Badge>
                      ) : avatarNode}
                      main={(
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 第一行：图标 + 名称 + 免打扰 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
                              {isPinned && <Pin size={10} style={{ color: 'var(--semi-color-primary)', flexShrink: 0 }} />}
                              {isStarred && <Star size={10} style={{ color: '#facc15', flexShrink: 0 }} />}
                              <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {name}
                              </Text>
                            </div>
                            {isMuted && <BellOff size={11} style={{ color: 'var(--semi-color-text-3)', flexShrink: 0 }} />}
                          </div>
                          {/* 第二行：消息预览 + 时间 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, marginTop: 2 }}>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                              {hasFailedMsg && (
                                <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--semi-color-danger)', fontWeight: 500 }}>[发送失败]</span>
                              )}
                              {!hasFailedMsg && hasDraft && (
                                <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--semi-color-danger)', fontWeight: 500 }}>[草稿]</span>
                              )}
                              {!hasFailedMsg && !hasDraft && hasMentionUnread && (
                                <span
                                  style={{
                                    flexShrink: 0,
                                    fontSize: 11,
                                    lineHeight: '16px',
                                    padding: '0 4px',
                                    borderRadius: 'var(--semi-border-radius-small)',
                                    color: 'var(--semi-color-danger)',
                                    background: 'var(--semi-color-danger-light-default)',
                                  }}
                                >
                                  @我
                                </span>
                              )}
                              <Text
                                type={(hasFailedMsg || hasDraft) ? 'danger' : 'tertiary'}
                                style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                              >
                                {hasDraft ? draftText.trim() : lastMsgText}
                              </Text>
                            </div>
                            {lastMsg && (
                              <Text type="tertiary" style={{ fontSize: 11, flexShrink: 0 }}>
                                {formatConvTime(lastMsg.createdAt)}
                              </Text>
                            )}
                          </div>
                        </div>
                      )}
                    />
                  );
}
