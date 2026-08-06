import { Dropdown, Toast } from '@douyinfe/semi-ui';
import { Archive, ArchiveRestore, BellOff, Bookmark, Pin, Search, Star } from 'lucide-react';
import { request } from '@/utils/request';
import { confirmDelete } from '@/utils/confirm';
import type { ChatConversation, ChatMessage } from '@zenith/shared/chat';
import { removeConversationById, toggleConvMuted, toggleConvStarred, togglePinAndSort } from '../utils-state';
import type { LeftPaneContextMenuState, Setter } from '../types';

/** 左栏右键菜单：会话（置顶/星标/免打扰/归档/删除）与收藏（定位/取消收藏）（自 ChatPage 原样搬移） */
export function LeftPaneContextMenu({
  leftPaneContextMenu, setLeftPaneContextMenu, setConversations, activeConvId, setActiveConvId, setMessages,
  setPendingNewMsgCount, openFavoriteMessage, setFavPreviewVisible, handleToggleFavorite, handleTogglePinMessage,
}: Readonly<{
  leftPaneContextMenu: LeftPaneContextMenuState;
  setLeftPaneContextMenu: Setter<LeftPaneContextMenuState | null>;
  setConversations: Setter<ChatConversation[]>;
  activeConvId: number | null;
  setActiveConvId: Setter<number | null>;
  setMessages: Setter<ChatMessage[]>;
  setPendingNewMsgCount: Setter<number>;
  openFavoriteMessage: (message: ChatMessage) => Promise<void>;
  setFavPreviewVisible: Setter<boolean>;
  handleToggleFavorite: (msg: ChatMessage) => Promise<void>;
  handleTogglePinMessage: (msg: ChatMessage) => Promise<void>;
}>) {
  const targetId = leftPaneContextMenu.type === 'conversation'
    ? leftPaneContextMenu.conv.id
    : leftPaneContextMenu.msg.id;

  return (
              <Dropdown
                trigger="click"
                visible
                clickToHide
                position="bottomLeft"
                autoAdjustOverflow
                rePosKey={`${leftPaneContextMenu.type}:${targetId}:${leftPaneContextMenu.x}:${leftPaneContextMenu.y}`}
                getPopupContainer={() => document.body}
                onVisibleChange={(visible) => {
                  if (!visible) setLeftPaneContextMenu(null);
                }}
                render={leftPaneContextMenu.type === 'conversation' ? (
                  <Dropdown.Menu style={{ maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}>
                    <Dropdown.Item
                      icon={<Pin size={13} />}
                      onClick={() => {
                        const { conv } = leftPaneContextMenu;
                        const isPinned = conv.isPinned ?? false;
                        void request.patch(`/api/chat/conversations/${conv.id}/pin`, { pin: !isPinned }).then((r) => {
                          if ((r as { code: number }).code === 0) {
                            setConversations(togglePinAndSort(conv.id, isPinned));
                            Toast.success(isPinned ? '已取消置顶' : '已置顶');
                          }
                        });
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      {(leftPaneContextMenu.conv.isPinned ?? false) ? '取消置顶' : '置顶'}
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<Star size={13} />}
                      onClick={() => {
                        const { conv } = leftPaneContextMenu;
                        const isStarred = conv.isStarred ?? false;
                        void request.patch(`/api/chat/conversations/${conv.id}/star`, { star: !isStarred }).then((r) => {
                          if ((r as { code: number }).code === 0) {
                            setConversations(toggleConvStarred(conv.id, isStarred));
                            Toast.success(isStarred ? '已取消星标' : '已标记星标');
                          }
                        });
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      {(leftPaneContextMenu.conv.isStarred ?? false) ? '取消星标' : '标记星标'}
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<BellOff size={13} />}
                      onClick={() => {
                        const { conv } = leftPaneContextMenu;
                        const isMuted = conv.isMuted ?? false;
                        void request.patch(`/api/chat/conversations/${conv.id}/mute`, { mute: !isMuted }).then((r) => {
                          if ((r as { code: number }).code === 0) {
                            setConversations(toggleConvMuted(conv.id, isMuted));
                            Toast.success(isMuted ? '已取消免打扰' : '已开启免打扰');
                          }
                        });
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      {(leftPaneContextMenu.conv.isMuted ?? false) ? '取消免打扰' : '免打扰'}
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={(leftPaneContextMenu.conv.isArchived ?? false) ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                      onClick={() => {
                        const { conv } = leftPaneContextMenu;
                        const isArchived = conv.isArchived ?? false;
                        void request.patch(`/api/chat/conversations/${conv.id}/archive`, { archive: !isArchived }).then((r) => {
                          if ((r as { code: number }).code === 0) {
                            setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, isArchived: !isArchived } : c));
                            Toast.success(isArchived ? '已取消归档' : '已归档，可在「已归档」分组中查看');
                          }
                        });
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      {(leftPaneContextMenu.conv.isArchived ?? false) ? '取消归档' : '归档会话'}
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      type="danger"
                      onClick={() => {
                        const { conv } = leftPaneContextMenu;
                        confirmDelete({
                          title: '确定要删除该会话吗？',
                          content: '删除后仅移除你当前账号下的会话记录，无法恢复。',
                          onOk: () => {
                            void request.delete(`/api/chat/conversations/${conv.id}`).then((r) => {
                              if (r.code !== 0) return;
                              Toast.success('会话已删除');
                              setConversations(removeConversationById(conv.id));
                              if (activeConvId === conv.id) {
                                setActiveConvId(null);
                                setMessages([]);
                                setPendingNewMsgCount(0);
                              }
                            });
                          },
                        });
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      删除会话
                    </Dropdown.Item>
                  </Dropdown.Menu>
                ) : (
                  <Dropdown.Menu style={{ maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}>
                    <Dropdown.Item
                      icon={<Search size={12} />}
                      onClick={() => {
                        void openFavoriteMessage(leftPaneContextMenu.msg);
                        setFavPreviewVisible(false);
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      定位到原消息
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<Bookmark size={12} />}
                      onClick={() => {
                        void handleToggleFavorite(leftPaneContextMenu.msg);
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      取消收藏
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<Pin size={12} />}
                      onClick={() => {
                        void handleTogglePinMessage(leftPaneContextMenu.msg);
                        setLeftPaneContextMenu(null);
                      }}
                    >
                      {leftPaneContextMenu.msg.extra?.isPinned ? '取消置顶消息' : '置顶消息'}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                )}
              >
                <span
                  style={{
                    position: 'fixed',
                    left: leftPaneContextMenu.x,
                    top: leftPaneContextMenu.y,
                    width: 1,
                    height: 1,
                    pointerEvents: 'none',
                  }}
                />
              </Dropdown>
  );
}
