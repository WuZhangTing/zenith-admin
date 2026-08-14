import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { AppModal } from '@/components/AppModal';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Input, Button, Badge, Divider, Typography, Empty, Spin, Toast, Tooltip, ImagePreview, List as SemiList } from '@douyinfe/semi-ui';
import { Virtuoso, type VirtuosoHandle, type Components } from 'react-virtuoso';

import { Search, MessageSquarePlus, Send, CornerDownLeft, Smile, ImagePlus, MoreHorizontal, X, Paperclip, Bookmark, History, Images, ArrowLeft, ExternalLink, BarChart3, Download, Mic, Phone, Video, Compass, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MasterDetailLayout } from '@/components/MasterDetailLayout';
import { request } from '@/utils/request';
import { fetchManagedFileBlob, canPreviewFile, isSpreadsheetFile, resolveFileMimeType } from '@/utils/file-utils';
import FilePreviewModal from '@/components/FilePreviewModal';
import type { ChatConversation, ChatMessage, ChatMessageExtra, ChatGroupMember, ChatMessageSearchItem, ChatMessageContext, ChatReadState } from '@zenith/shared/chat';
import type { Channel } from '@zenith/shared/messaging';
import {
  shouldDisplayMessageTime,
} from './utils';
import './ChatPage.css';
import type { PendingImage, PendingFile, SearchDatePreset, FailedMessage, UploadingItem, MessageReadReceipt } from './types';
import { UserAvatar } from '@/components/UserAvatar';
import { NewChatPanel } from './components/NewChatPanel';
import { GroupMembersPanel } from './components/GroupMembersPanel';
import { ForwardModal } from './components/ForwardModal';
import { ForwardedMessagesModal } from './components/ForwardedMessagesModal';
import { VotePollModal } from './components/VotePollModal';
import { MessageBubble } from './components/MessageBubble';
import { ChannelMessageView } from './components/ChannelMessageView';
import { ComposerExtras } from './components/ComposerExtras';
import { JoinInviteModal } from './components/JoinInviteModal';

import WorkflowApprovalDetailSheet from '@/components/workflow/WorkflowApprovalDetailSheet';
import { getChatNotifyPrefs, setChatNotifyPrefs } from './notifyPrefs';
import { usePermission } from '@/hooks/usePermission';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useAddChatCustomEmoji, useChatGroupMembers } from '@/hooks/queries/chat';
import type { LeftListItem } from './types';
import {
  VIRTUOSO_FIRST_INDEX_BUFFER, computeLeftListModel, createComposerKeyDownHandler, getReplyPreviewText,
  getRootStyle, markCardDoneLocal, markConversationReadById,
} from './utils-state';
import { useOverlayDismiss } from './hooks/useOverlayDismiss';
import { useExportChat } from './hooks/useExportChat';
import { useChannelsAndDiscover } from './hooks/useChannelsAndDiscover';
import { useImagePreview } from './hooks/useImagePreview';
import { useConversationExtras } from './hooks/useConversationExtras';
import { useCardAndCall } from './hooks/useCardAndCall';
import { useMessagesLoader } from './hooks/useMessagesLoader';
import { useChatDrafts } from './hooks/useChatDrafts';
import { useConversationSelection } from './hooks/useConversationSelection';
import { useSendMedia } from './hooks/useSendMedia';
import { useComposerActions } from './hooks/useComposerActions';
import { useMessageActions } from './hooks/useMessageActions';
import { useConversationSearch } from './hooks/useConversationSearch';
import { useMediaLibrary } from './hooks/useMediaLibrary';
import { useChatWebSocket } from './hooks/useChatWebSocket';
import { useGroupAvatars } from './hooks/useGroupAvatars';
import { ArchiveToggle } from './components/ArchiveToggle';
import { LeftListRow } from './components/LeftListRow';
import { FavoriteListRow } from './components/FavoriteListRow';
import { GlobalSearchPane } from './components/GlobalSearchPane';
import { LeftPaneContextMenu } from './components/LeftPaneContextMenu';
import { ChatConvTitle } from './components/ChatConvTitle';
import { NotifySettingsPopover } from './components/NotifySettingsPopover';
import { UploadingFooter } from './components/UploadingFooter';
import { MessagesListHeader } from './components/MessagesListHeader';
import { FailedMessagesList } from './components/FailedMessagesList';
import { MediaPanel } from './components/MediaPanel';
import { AnnouncementHistoryModal } from './components/AnnouncementHistoryModal';
import { MultiSelectActionBar } from './components/MultiSelectActionBar';
import { PendingAttachments } from './components/PendingAttachments';
import { MentionPopup } from './components/MentionPopup';
import { TypingIndicator } from './components/TypingIndicator';
import { DiscoverChannelsModal } from './components/DiscoverChannelsModal';
import { FavoriteMessageModal } from './components/FavoriteMessageModal';
import { MessageSearchModal } from './components/MessageSearchModal';
import { WsDisconnectedBanner } from './components/WsDisconnectedBanner';

// emoji-mart（~490KB 含全量表情元数据）仅在用户首次打开表情浮层时才加载
const ComposerEmojiPicker = lazy(() => import('./components/ComposerEmojiPicker').then((m) => ({ default: m.ComposerEmojiPicker })));
const ReactionPickerOverlay = lazy(() => import('./components/ReactionPickerOverlay').then((m) => ({ default: m.ReactionPickerOverlay })));

const { Text, Title } = Typography;

/** 稳定空数组：避免群成员查询无数据时每次渲染都产出新引用 */
const EMPTY_GROUP_MEMBERS: ChatGroupMember[] = [];

/**
 * Virtuoso Header/Footer 依赖的数据经 context 传入，组件本身定义在模块级。
 * 内联在 components={{...}} 里的箭头函数每次渲染都是新组件类型，
 * 会导致 Header/Footer 被卸载重挂而非更新。
 */
interface MessagesVirtuosoContext {
  uploadingItems: UploadingItem[];
  activeConvId: number | null;
  isQuick: boolean;
  wsConnected: boolean;
  pinnedMessages: ChatMessage[];
  scrollToMessage: (messageId: number) => Promise<void>;
  handleTogglePinMessage: (msg: ChatMessage) => Promise<void>;
  hasMore: boolean;
  loadingMsgs: boolean;
}

function MessagesVirtuosoFooter({ context }: Readonly<{ context?: MessagesVirtuosoContext }>) {
  if (!context) return null;
  return (
    <UploadingFooter
      uploadingItems={context.uploadingItems} activeConvId={context.activeConvId} isQuick={context.isQuick}
    />
  );
}

function MessagesVirtuosoHeader({ context }: Readonly<{ context?: MessagesVirtuosoContext }>) {
  if (!context) return null;
  return (
    <MessagesListHeader
      isQuick={context.isQuick} wsConnected={context.wsConnected} pinnedMessages={context.pinnedMessages}
      scrollToMessage={context.scrollToMessage} handleTogglePinMessage={context.handleTogglePinMessage}
      hasMore={context.hasMore} loadingMsgs={context.loadingMsgs}
    />
  );
}

const MESSAGES_VIRTUOSO_COMPONENTS: Components<ChatMessage, MessagesVirtuosoContext> = {
  Footer: MessagesVirtuosoFooter,
  Header: MessagesVirtuosoHeader,
};

const computeMessageItemKey = (_idx: number, msg: ChatMessage) => msg.id;

export interface ChatPageProps {
  variant?: 'page' | 'quick';
  onClose?: () => void;
  onOpenFullPage?: (convId?: number | null) => void;
  onUnreadChange?: (count: number) => void;
  onConvChange?: (convId: number | null) => void;
}

export default function ChatPage({
  variant = 'page',
  onClose,
  onOpenFullPage,
  onUnreadChange,
  onConvChange,
}: Readonly<ChatPageProps> = {}) {
  const isQuick = variant === 'quick';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [cardSheet, setCardSheet] = useState<{ instanceId: number; taskId: number | null; action: 'approve' | 'reject' | null; messageId?: number } | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [discoverVisible, setDiscoverVisible] = useState(false);
  const [discoverKeyword, setDiscoverKeyword] = useState('');
  const [debouncedDiscoverKeyword, setDebouncedDiscoverKeyword] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [mentionClosed, setMentionClosed] = useState(false);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [emojiVisible, setEmojiVisible] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<{ top: number; left: number } | null>(null);

  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState<{ top: number; right: number } | null>(null);
  const [reactionTargetMsgId, setReactionTargetMsgId] = useState<number | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [oldestMsgId, setOldestMsgId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pendingNewMsgCount, setPendingNewMsgCount] = useState(0);
  const [msgSearch, setMsgSearch] = useState('');
  const [searchTypeFilters, setSearchTypeFilters] = useState<ChatMessage['type'][]>([]);
  const [searchSenderId, setSearchSenderId] = useState<number | undefined>();
  const [searchTimeRange, setSearchTimeRange] = useState<[Date, Date] | null>(null);
  const [searchDatePreset, setSearchDatePreset] = useState<SearchDatePreset>('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<ChatMessageSearchItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasSearched, setSearchHasSearched] = useState(false);
  const [searchMembers, setSearchMembers] = useState<ChatGroupMember[]>([]);
  const [groupAvatarMap, setGroupAvatarMap] = useState<Record<number, Array<{ id: number; nickname: string; avatar?: string | null }>>>({});
  const [readStates, setReadStates] = useState<ChatReadState[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(() => new Set());
  const [lastSeenMap, setLastSeenMap] = useState<Record<number, string | null>>({});
  const [notifyDesktop, setNotifyDesktop] = useState(() => getChatNotifyPrefs().desktop);
  const [notifySound, setNotifySound] = useState(() => getChatNotifyPrefs().sound);
  const [notifyPermission, setNotifyPermission] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'default'));
  const [selectedMentions, setSelectedMentions] = useState<Array<{ userId: number; nickname: string }>>([]);
  const [leftPaneMode, setLeftPaneMode] = useState<'conversations' | 'favorites' | 'globalSearch'>('conversations');
  const [globalSearchKeyword, setGlobalSearchKeyword] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<import('@zenith/shared').ChatMessageSearchItem[]>([]);
  const [globalSearchTotal, setGlobalSearchTotal] = useState(0);
  const [globalSearchPage, setGlobalSearchPage] = useState(1);
  const [globalSearchHasSearched, setGlobalSearchHasSearched] = useState(false);
  const [globalSearchConvNames, setGlobalSearchConvNames] = useState<Record<string, string>>({});
  const [favoriteMessages, setFavoriteMessages] = useState<ChatMessage[]>([]);
  const [leftPaneContextMenu, setLeftPaneContextMenu] = useState<
    | { x: number; y: number; type: 'conversation'; conv: ChatConversation }
    | { x: number; y: number; type: 'favorite'; msg: ChatMessage }
    | null
  >(null);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [announcementHistoryVisible, setAnnouncementHistoryVisible] = useState(false);
  const [recalledDrafts, setRecalledDrafts] = useState<Record<number, { content: string; mentions?: Array<{ userId: number; nickname: string }> }>>({});
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardingMessageIds, setForwardingMessageIds] = useState<number[]>([]);
  const [forwardingMode, setForwardingMode] = useState<'merge' | 'individual'>('individual');
  const [forwardViewVisible, setForwardViewVisible] = useState(false);
  const [forwardViewItems, setForwardViewItems] = useState<NonNullable<ChatMessageExtra['forwardedMessages']>>([]);
  const [forwardViewTitle, setForwardViewTitle] = useState('');
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [favPreviewVisible, setFavPreviewVisible] = useState(false);
  const [favPreviewMsg, setFavPreviewMsg] = useState<ChatMessage | null>(null);
  const [contextMode, setContextMode] = useState<{ anchorMessageId: number; keyword: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<number, { nickname: string; timer: ReturnType<typeof setTimeout> }>>({});
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);
  const [draftsMap, setDraftsMap] = useState<Record<number, string>>({});
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'file' | 'link'>('image');
  const [mediaItems, setMediaItems] = useState<ChatMessage[]>([]);
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaHasMore, setMediaHasMore] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewSrcList, setPreviewSrcList] = useState<string[]>([]);
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0);
  const [filePreview, setFilePreview] = useState<{ fileId?: string; url: string; name: string; mimeType: string } | null>(null);

  const handleMediaFilePreview = useCallback((item: ChatMessage) => {
    const asset = item.extra?.asset;
    if (!asset || !canPreviewFile(asset.mimeType, asset.name)) return;
    if (isSpreadsheetFile(resolveFileMimeType(asset.mimeType, asset.name)) && !asset.fileId) {
      void fetchManagedFileBlob(item.content).then((blob) => {
        const objectUrl = globalThis.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = asset.name ?? '文件.xlsx';
        link.click();
        globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(objectUrl), 60_000);
      }).catch(() => Toast.error('文件下载失败'));
      return;
    }
    setFilePreview({ url: item.content, name: asset.name ?? '文件', mimeType: asset.mimeType ?? 'application/octet-stream', fileId: asset.fileId ?? undefined });
  }, []);
  const previewSessionRef = useRef(0);
  const previewBlobUrlsRef = useRef<string[]>([]);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAtBottomRef = useRef(true);
  const showMediaPanelRef = useRef(showMediaPanel);
  showMediaPanelRef.current = showMediaPanel;
  const mediaTypeRef = useRef(mediaType);
  mediaTypeRef.current = mediaType;
  const activeConvIdRef = useRef(activeConvId);
  activeConvIdRef.current = activeConvId;
  const [firstItemIndex, setFirstItemIndex] = useState(VIRTUOSO_FIRST_INDEX_BUFFER);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileAttachRef = useRef<HTMLInputElement>(null);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const wsHasConnectedRef = useRef(false);
  const wsDisconnectedSinceReadyRef = useRef(false);

  useOverlayDismiss({
    emojiVisible, setEmojiVisible, emojiContainerRef, emojiPickerRef, reactionPickerVisible, setReactionPickerVisible,
    reactionPickerRef, pendingImages, pendingImagesRef,
  });

  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const currentUserNickname = authUser?.nickname ?? authUser?.username ?? '我';
  const { hasPermission } = usePermission();

  const { exportingChat, handleExportChat } = useExportChat();

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;
  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  // 群成员是服务端状态，交给 Query 统一持有：GroupMembersPanel 用的是同一个缓存条目，
  // 因此加人/踢人/转让群主等 mutation 失效后，本页的 @提及候选、群主判定会一起刷新。
  // 此前这里另存了一份 useState 副本，只在切换会话时拉取，面板改完成员后本页仍是旧数据。
  const groupMembersQuery = useChatGroupMembers(
    activeConvId ?? undefined,
    activeConv?.type === 'group',
  );
  const activeGroupMembers = groupMembersQuery.data ?? EMPTY_GROUP_MEMBERS;

  const queryClient = useQueryClient();

  // 未读分隔线：进入会话时按 unreadCount 定位首条未读消息
  const [unreadDivider, setUnreadDivider] = useState<{ convId: number; messageId: number } | null>(null);

  // 已归档会话折叠分组：是否展开查看归档列表
  const [showArchived, setShowArchived] = useState(false);

  // 邀请链接落地（?invite=TOKEN）
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // 收藏表情
  const addEmojiMutation = useAddChatCustomEmoji();

  // 禁言状态：个人禁言优先；全员禁言豁免群主/管理员
  const [muteTick, setMuteTick] = useState(0);
  const muteState = useMemo(() => {
    void muteTick; // 禁言到期时触发重算
    if (!activeConv || activeConv.type !== 'group') return null;
    const until = activeConv.myMutedUntil ? dayjs(activeConv.myMutedUntil) : null;
    if (until?.isAfter(dayjs())) {
      return {
        placeholder: until.year() >= 9000 ? '你已被禁言' : `你已被禁言，${until.format('MM-DD HH:mm')} 解除`,
        until,
      };
    }
    if (activeConv.muteAll && (activeConv.myRole ?? 'member') === 'member') {
      return { placeholder: '全员禁言中，仅群主和管理员可发言', until: null };
    }
    return null;
  }, [activeConv, muteTick]);

  // 限时禁言到期后自动恢复输入框
  useEffect(() => {
    if (!muteState?.until || muteState.until.year() >= 9000) return;
    const ms = muteState.until.diff(dayjs()) + 1000;
    if (ms <= 0 || ms > 24 * 3600 * 1000) return;
    const timer = setTimeout(() => setMuteTick((v) => v + 1), ms);
    return () => clearTimeout(timer);
  }, [muteState]);

  const mentionState = useMemo(() => {
    if (activeConv?.type !== 'group') return null;
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const prefix = input.slice(0, cursor);
    const atIndex = prefix.lastIndexOf('@');
    if (atIndex < 0) return null;
    if (atIndex > 0 && !/\s/.test(prefix[atIndex - 1] ?? '')) return null;
    const query = prefix.slice(atIndex + 1);
    if (query.includes(' ') || query.includes('\n')) return null;
    return { start: atIndex, end: cursor, query };
  }, [activeConv, input]);

  const ALL_MEMBERS_VIRTUAL: ChatGroupMember = { id: -1, nickname: '全体成员', username: 'all', role: 'member' };

  const mentionCandidates = useMemo(() => {
    if (!mentionState) return [];
    const kw = mentionState.query.trim().toLowerCase();
    const members = activeGroupMembers.filter((member) => {
      if (member.id === currentUserId) return false;
      if (!kw) return true;
      return member.nickname.toLowerCase().includes(kw) || member.username.toLowerCase().includes(kw);
    }).slice(0, 7);
    // 在群聊中支持 @全体成员
    if (activeConv?.type === 'group') {
      const allMatches = !kw || '全体成员'.includes(kw) || 'all'.includes(kw);
      if (allMatches) return [ALL_MEMBERS_VIRTUAL, ...members];
    }
    return members;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.type, activeGroupMembers, currentUserId, mentionState]);

  const {
    fetchConversations, handleUnsubscribeChannel, openDiscover, discoverList,
    handleSubscribeChannel,
  } = useChannelsAndDiscover({
    discoverVisible, discoverKeyword, debouncedDiscoverKeyword, setLoadingConvs, setConversations, setChannels,
    setActiveChannelId, setDiscoverKeyword, setDebouncedDiscoverKeyword, setDiscoverVisible,
  });

  // 初始化时从 localStorage 加载所有草稿
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zenith_chat_drafts');
      if (raw) {
        const drafts = JSON.parse(raw) as Record<string, string>;
        const map: Record<number, string> = {};
        for (const [k, v] of Object.entries(drafts)) {
          if (v.trim()) map[Number(k)] = v;
        }
        setDraftsMap(map);
      }
    } catch { /* ignore */ }
  }, []);

  // 用户正在输入时，实时更新当前会话的草稿 map（不写 localStorage，仅更新 state）
  useEffect(() => {
    if (!activeConvId) return;
    setDraftsMap((prev) => {
      if (input.trim()) return { ...prev, [activeConvId]: input };
      const next = { ...prev };
      delete next[activeConvId];
      return next;
    });
  }, [activeConvId, input]);

  // 读取 URL ?conv= 参数，在会话列表加载后自动激活对应会话
  useEffect(() => {
    if (isQuick) return;
    const convParam = searchParams.get('conv');
    if (!convParam) return;
    const convId = Number(convParam);
    if (!Number.isFinite(convId) || convId <= 0) return;
    if (conversations.length === 0) return; // 等列表加载完再处理
    const conv = conversations.find((c) => c.id === convId);
    if (!conv) return;
    setSearchParams((prev) => { prev.delete('conv'); return prev; }, { replace: true });
    void handleSelectConv(conv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, isQuick]);

  // 读取 URL ?invite= 邀请令牌，弹出入群确认
  useEffect(() => {
    if (isQuick) return;
    const invite = searchParams.get('invite');
    if (!invite) return;
    setInviteToken(invite);
    setSearchParams((prev) => { prev.delete('invite'); return prev; }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuick]);

  const { cleanupPreviewBlobs, openImagePreview } = useImagePreview({
    previewSessionRef, previewBlobUrlsRef, setPreviewSrcList, setPreviewCurrentIndex, setPreviewVisible,
  });

  const {
    fetchFavoriteMessages, announcementHistory, isOwnerOfActiveGroup, handleDeleteAnnouncementHistory, openFavoriteMessage,
    computeReadReceipt,
  } = useConversationExtras({
    activeConvId, announcementHistoryVisible, activeConv, activeGroupMembers, currentUserId, conversations,
    readStates, setPinnedMessages, setFavoriteMessages, setLeftPaneMode, setActiveConvId, setMessages,
    setHasMore, setOldestMsgId, setContextMode, setReadStates, setOnlineUserIds, setLastSeenMap,
  });

  const handleToggleNotifyDesktop = useCallback(async (checked: boolean) => {
    if (checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      setNotifyPermission(perm);
      if (perm !== 'granted') { Toast.warning('通知权限被拒绝，无法开启桌面通知'); return; }
    }
    setNotifyDesktop(checked);
    setChatNotifyPrefs({ desktop: checked, sound: notifySound });
  }, [notifySound]);

  const handleToggleNotifySound = useCallback((checked: boolean) => {
    setNotifySound(checked);
    setChatNotifyPrefs({ desktop: notifyDesktop, sound: checked });
  }, [notifyDesktop]);

  const { handleOpenWorkflowFromCard, handleCardAction, handleStartCall } = useCardAndCall({
    activeConv, navigate, setCardSheet,
  });

  const { fetchMessages } = useMessagesLoader({
    leftPaneMode, fetchFavoriteMessages, setLoadingMsgs, setMessages, setOldestMsgId, setFirstItemIndex,
    setPendingNewMsgCount, setContextMode, setHasMore,
  });

  const { saveDraft, loadDraft } = useChatDrafts({ setDraftsMap });

  const { handleSelectConv, handleNewDirectChat, handleGroupCreated, appendMessageOnce } = useConversationSelection({
    activeConvId, input, currentUserId, onConvChange, saveDraft, loadDraft,
    fetchMessages, fetchConversations, virtuosoRef, showMediaPanelRef, mediaTypeRef, activeConvIdRef,
    setActiveConvId, setActiveChannelId, setReplyTo, setSelectedMentions, setPendingImages, setPendingFiles,
    setLeftPaneMode, setAnnouncementHistoryVisible, setShowMembers, setShowSearchPanel, setMsgSearch, setSearchTypeFilters,
    setSearchSenderId, setSearchTimeRange, setSearchDatePreset, setSearchResults, setSearchTotal, setSearchPage,
    setSearchHasSearched, setContextMode, setShowMediaPanel, setMediaItems, setMediaPage, setMediaHasMore,
    setInput, setUnreadDivider, setConversations, setShowNewChat, setMessages,
  });

  const {
    sendFileMessage, sendSticker, handleSaveAsEmoji, handleTyping, sendImageFile,
    voiceRecorder, fetchLinkPreview,
  } = useSendMedia({
    activeConvId, currentUserId, currentUserNickname, appendMessageOnce, addEmojiMutation, typingThrottleRef,
    setEmojiVisible,
  });

  const {
    handleSend, handleSelectImages, handleSelectFile, handleRemovePendingImage, handleRemovePendingFile, handleInputPaste,
    scrollToMessage, getReplyMessage, insertMention, applyMessageUpdate,
  } = useComposerActions({
    activeConvId, sending, setSending, input, setInput, pendingImages,
    setPendingImages, pendingFiles, setPendingFiles, saveDraft, setDraftsMap, replyTo,
    setReplyTo, selectedMentions, setSelectedMentions, fetchLinkPreview, appendMessageOnce, setFailedMessages,
    setUploadingItems, sendImageFile, sendFileMessage, setHighlightedMessageId, messages, virtuosoRef,
    firstItemIndex, setMessages, setHasMore, setOldestMsgId, setFirstItemIndex, setContextMode,
    mentionState, setMentionClosed, activeGroupMembers, currentUserId, inputRef, setPinnedMessages,
    setFavoriteMessages, setConversations,
  });

  const {
    handleToggleFavorite, handleTogglePinMessage, handleEditRecalled, handleToggleSelectMessage, handleExitMultiSelect, handleForwardSingle,
    handleForwardSelected, handleForwardConfirm, handleFavoriteSelected, handleOpenForwardView, handleDeleteSingle, handleDeleteSelected,
    handleReaction, handlePickReactionEmoji, handleCreateVote, handleVoteMessage, handleEditMessage, handleRecall,
  } = useMessageActions({
    activeConvId, messages, selectedMessageIds, recalledDrafts, forwardingMessageIds, forwardingMode,
    inputRef, applyMessageUpdate, appendMessageOnce, setInput, setSelectedMentions,
    setMultiSelectMode, setSelectedMessageIds, setForwardingMode, setForwardingMessageIds, setForwardModalVisible, setForwardViewItems,
    setForwardViewTitle, setForwardViewVisible, setMessages, setMediaItems, setReactionTargetMsgId, setReactionPickerAnchor,
    setReactionPickerVisible, setShowVoteModal, setRecalledDrafts,
  });

  const { resetSearchFilters, applyDatePreset, senderOptions, executeSearch, jumpToSearchResult } = useConversationSearch({
    activeConv, activeConvId, currentUserId, currentUserNickname, messages, msgSearch,
    searchMembers, searchResults, searchSenderId, searchTimeRange, searchTypeFilters, showSearchPanel,
    scrollToMessage, setContextMode, setHasMore, setMessages, setMsgSearch, setOldestMsgId,
    setSearchDatePreset, setSearchHasSearched, setSearchLoading, setSearchMembers, setSearchPage, setSearchResults,
    setSearchSenderId, setSearchTimeRange, setSearchTotal, setSearchTypeFilters, setShowMembers, setShowSearchPanel,
  });

  const restoreLatestMessages = useCallback(async () => {
    if (!activeConvId) return;
    await fetchMessages(activeConvId);
  }, [activeConvId, fetchMessages]);

  const { fetchMediaItems } = useMediaLibrary({
    activeConvId, mediaType, showMediaPanel, setMediaHasMore, setMediaItems, setMediaLoading,
    setMediaPage,
  });

  const { refreshGroupAvatarMembers, handleAtBottomStateChange, handleStartReached, wsConnected } = useChatWebSocket({
    activeChannelId, activeConvId, contextMode, conversations, currentUserId, hasMore,
    loadingMsgs, oldestMsgId, pendingNewMsgCount, queryClient, restoreLatestMessages,
    fetchConversations, fetchMessages, appendMessageOnce, applyMessageUpdate,
    isAtBottomRef, virtuosoRef, wsDisconnectedSinceReadyRef, wsHasConnectedRef, setActiveConvId, setChannels,
    setConversations, setGroupAvatarMap, setLastSeenMap, setMediaItems, setMessages, setOnlineUserIds,
    setPendingNewMsgCount, setReadStates, setTypingUsers,
  });

  // 草稿自动保存（input 变化时持久化）
  useEffect(() => {
    if (activeConvId) saveDraft(activeConvId, input);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // mentionCandidates 变化时重置高亮到第一项
  useEffect(() => {
    setMentionActiveIndex(0);
  }, [mentionCandidates]);

  const handleKeyDown = createComposerKeyDownHandler({
    mentionState, mentionClosed, mentionCandidates, mentionActiveIndex,
    setMentionActiveIndex, mentionListRef, insertMention, setMentionClosed, handleSend,
  });

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    const ta = inputRef.current;
    if (!ta) {
      setInput((prev) => prev + emoji.native);
      return;
    }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    setInput((prev) => prev.slice(0, start) + emoji.native + prev.slice(end));
    setEmojiVisible(false);
    requestAnimationFrame(() => {
      const pos = start + emoji.native.length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    });
  }, [input]);

  const { archivedConvs, archivedUnread, showArchiveToggle, leftListItems, totalUnread } = computeLeftListModel({
    conversations, channels, convSearch, showArchived,
  });

  /** 打开全局搜索结果：拉取上下文并跳转（原全局搜索列表 onClick 内联逻辑原样搬出） */
  const onOpenSearchResult = async (item: import('@zenith/shared').ChatMessageSearchItem) => {
    const res = await request.get<ChatMessageContext>(
      `/api/chat/conversations/${item.message.conversationId}/messages/${item.message.id}/context?before=15&after=15`,
      { silent: true },
    );
    if (res.code !== 0 || !res.data) {
      import('@douyinfe/semi-ui').then(({ Toast }) => Toast.error('定位消息失败'));
      return;
    }
    const targetConv = conversations.find((c) => c.id === item.message.conversationId);
    if (!targetConv) {
      // 会话不在列表中，刷新列表再定位
      await fetchConversations();
    }
    setActiveConvId(item.message.conversationId);
    onConvChange?.(item.message.conversationId);
    setLeftPaneMode('conversations');
    setMessages(res.data.list);
    setHasMore(res.data.hasBefore);
    setOldestMsgId(res.data.list[0]?.id ?? null);
    setContextMode({ anchorMessageId: res.data.anchorMessageId, keyword: globalSearchKeyword.trim() });
    setTimeout(() => scrollToMessage(res.data.anchorMessageId), 80);
  };

  // 频道列表本地过滤：按名称包含匹配，不调接口
  const channelAvatarNode = useCallback((ch: Channel) => (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <UserAvatar name={ch.name} avatar={ch.avatar} size={38} />
      <BadgeCheck
        size={15}
        style={{ position: 'absolute', right: -2, bottom: -2, color: '#fff', fill: 'var(--semi-color-primary)' }}
        aria-label="官方频道"
      />
    </span>
  ), []);

  useEffect(() => {
    onUnreadChange?.(totalUnread);
  }, [onUnreadChange, totalUnread]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !currentUserId || !(m.extra?.hiddenFor ?? []).includes(currentUserId)),
    [messages, currentUserId],
  );
  const displayMessages = visibleMessages;

  /** 图集仅在点击图片时需要，点击时惰性收集，避免每次渲染都做 O(n) 过滤 */
  const handleOpenImageMessage = useCallback((imageMsg: ChatMessage) => {
    void openImagePreview(imageMsg, messages.filter((m) => m.type === 'image' && !m.isRecalled));
  }, [messages, openImagePreview]);

  /** 读回执按消息预计算，保持传给 MessageBubble 的对象身份稳定以配合其 memo */
  const readReceiptMap = useMemo(() => {
    const map = new Map<number, MessageReadReceipt | undefined>();
    for (const m of displayMessages) map.set(m.id, computeReadReceipt(m));
    return map;
  }, [displayMessages, computeReadReceipt]);

  const handleOpenFilePreview = useCallback((fileMsg: ChatMessage) => {
    const asset = fileMsg.extra?.asset;
    if (!asset || !canPreviewFile(asset.mimeType, asset.name)) return;
    // xlsx 历史消息无 fileId，退化为下载避免报错
    if (isSpreadsheetFile(resolveFileMimeType(asset.mimeType, asset.name)) && !asset.fileId) {
      void fetchManagedFileBlob(fileMsg.content).then((blob) => {
        const objectUrl = globalThis.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = asset.name ?? '文件.xlsx';
        link.click();
        globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(objectUrl), 60_000);
      }).catch(() => Toast.error('文件下载失败'));
      return;
    }
    setFilePreview({
      url: fileMsg.content,
      name: asset.name ?? '文件',
      mimeType: asset.mimeType ?? 'application/octet-stream',
      fileId: asset.fileId ?? undefined,
    });
  }, []);

  const virtuosoContext = useMemo<MessagesVirtuosoContext>(() => ({
    uploadingItems, activeConvId, isQuick, wsConnected, pinnedMessages,
    scrollToMessage, handleTogglePinMessage, hasMore, loadingMsgs,
  }), [uploadingItems, activeConvId, isQuick, wsConnected, pinnedMessages, scrollToMessage, handleTogglePinMessage, hasMore, loadingMsgs]);

  useGroupAvatars({ conversations, groupAvatarMap, setGroupAvatarMap, refreshGroupAvatarMembers });

  const rootStyle = getRootStyle(isQuick);

  const hasFailedInCurrentConv = failedMessages.some((m) => m.convId === activeConvId);
  const isEmptyMessagesView = displayMessages.length === 0 && !hasFailedInCurrentConv;
  const isInitialLoadingMessages = loadingMsgs && messages.length === 0;

  return (
    <div style={rootStyle}>
      <MasterDetailLayout
        defaultSize={280}
        minSize={220}
        maxSize={420}
        gap={0}
        divider
        persistKey={isQuick ? undefined : 'messages'}
        responsiveBreakpoint={isQuick ? 99999 : undefined}
        showDetail={!!activeConv || activeChannelId != null}
        onBack={isQuick ? undefined : () => setActiveConvId(null)}
        master={(
          <>
        <MasterDetailLayout.Header
          extra={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tooltip content="发现频道">
                <Button
                  size="small" theme="borderless" type="primary"
                  icon={<Compass size={16} />}
                  onClick={openDiscover}
                />
              </Tooltip>
              <Tooltip content="新建对话">
                <Button
                  size="small" theme="borderless" type="primary"
                  icon={<MessageSquarePlus size={16} />}
                  onClick={() => setShowNewChat((v) => !v)}
                />
              </Tooltip>
              {isQuick && onOpenFullPage && (
                <Tooltip content="前往聊天页">
                  <Button
                    size="small"
                    theme="borderless"
                    type="tertiary"
                    icon={<ExternalLink size={15} />}
                    onClick={() => onOpenFullPage(activeConvId)}
                  />
                </Tooltip>
              )}
              {isQuick && onClose && (
                <Tooltip content="关闭">
                  <Button
                    size="small"
                    theme="borderless"
                    type="tertiary"
                    icon={<X size={15} />}
                    onClick={onClose}
                  />
                </Tooltip>
              )}
            </div>
          }
        >
          {totalUnread > 0 ? (
            <Badge count={totalUnread} overflowCount={99}>
              <Title heading={6} style={{ margin: 0 }}>消息</Title>
            </Badge>
          ) : (
            <Title heading={6} style={{ margin: 0 }}>消息</Title>
          )}
        </MasterDetailLayout.Header>

        {showNewChat && (
          <AppModal
            title="新建对话"
            visible={showNewChat}
            onCancel={() => setShowNewChat(false)}
            footer={null}
            width={480}
            centered
          >
            <NewChatPanel
              onSelectUser={(u) => { handleNewDirectChat(u); setShowNewChat(false); }}
              onGroupCreated={(c) => { handleGroupCreated(c); setShowNewChat(false); }}
            />
          </AppModal>
        )}

        <div style={{ padding: '8px 12px' }}>
          <Input prefix={<Search size={13} />} placeholder="搜索会话" size="small" value={convSearch} onChange={setConvSearch} />
        </div>

        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 8 }}>
          <Button
            size="small"
            theme={leftPaneMode === 'conversations' ? 'solid' : 'borderless'}
            type={leftPaneMode === 'conversations' ? 'primary' : 'tertiary'}
            onClick={() => setLeftPaneMode('conversations')}
          >
            消息
          </Button>
          <Button
            size="small"
            theme={leftPaneMode === 'favorites' ? 'solid' : 'borderless'}
            type={leftPaneMode === 'favorites' ? 'primary' : 'tertiary'}
            icon={<Bookmark size={13} />}
            onClick={() => setLeftPaneMode('favorites')}
          >
            收藏
          </Button>
          <Button
            size="small"
            theme={leftPaneMode === 'globalSearch' ? 'solid' : 'borderless'}
            type={leftPaneMode === 'globalSearch' ? 'primary' : 'tertiary'}
            icon={<Search size={13} />}
            onClick={() => setLeftPaneMode('globalSearch')}
          >
            搜索
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
          <Spin spinning={loadingConvs}>
            {leftPaneMode === 'conversations' && showArchiveToggle && (
              <ArchiveToggle
                showArchived={showArchived} setShowArchived={setShowArchived} archivedConvs={archivedConvs}
                archivedUnread={archivedUnread}
              />
            )}
            {leftPaneMode === 'conversations' && (
              <SemiList
                className="chat-conv-list"
                dataSource={leftListItems}
                emptyContent={loadingConvs ? null : <Empty description="暂无会话" style={{ padding: '40px 0' }} imageStyle={{ width: 80 }} />}
                split={false}
                renderItem={(item: LeftListItem) => (
                  <LeftListRow
                    key={item.kind === 'channel' ? `channel-${item.channel.id}` : item.conv.id}
                    item={item} activeChannelId={activeChannelId} setActiveChannelId={setActiveChannelId}
                    setActiveConvId={setActiveConvId} setChannels={setChannels} channelAvatarNode={channelAvatarNode}
                    groupAvatarMap={groupAvatarMap} onlineUserIds={onlineUserIds} activeConvId={activeConvId}
                    failedMessages={failedMessages} draftsMap={draftsMap} handleSelectConv={handleSelectConv}
                    setLeftPaneContextMenu={setLeftPaneContextMenu}
                  />
                )}
              />
            )}
            {leftPaneMode === 'favorites' && (
              <SemiList
                className="chat-conv-list"
                dataSource={favoriteMessages}
                emptyContent={loadingConvs ? null : <Empty description="暂无收藏消息" style={{ padding: '40px 0' }} imageStyle={{ width: 80 }} />}
                split={false}
                renderItem={(msg: ChatMessage) => (
                  <FavoriteListRow
                    key={msg.id}
                    msg={msg} conversations={conversations} setFavPreviewMsg={setFavPreviewMsg}
                    setFavPreviewVisible={setFavPreviewVisible} setLeftPaneContextMenu={setLeftPaneContextMenu}
                  />
                )}
              />
            )}
            <GlobalSearchPane
              leftPaneMode={leftPaneMode} globalSearchKeyword={globalSearchKeyword} setGlobalSearchKeyword={setGlobalSearchKeyword}
              setGlobalSearchResults={setGlobalSearchResults} setGlobalSearchTotal={setGlobalSearchTotal} setGlobalSearchHasSearched={setGlobalSearchHasSearched}
              setGlobalSearchLoading={setGlobalSearchLoading} globalSearchLoading={globalSearchLoading} globalSearchHasSearched={globalSearchHasSearched}
              globalSearchTotal={globalSearchTotal} globalSearchResults={globalSearchResults} globalSearchPage={globalSearchPage}
              setGlobalSearchPage={setGlobalSearchPage} globalSearchConvNames={globalSearchConvNames} setGlobalSearchConvNames={setGlobalSearchConvNames}
              onOpenSearchResult={onOpenSearchResult}
            />
            {leftPaneContextMenu && (
              <LeftPaneContextMenu
                leftPaneContextMenu={leftPaneContextMenu} setLeftPaneContextMenu={setLeftPaneContextMenu} setConversations={setConversations}
                activeConvId={activeConvId} setActiveConvId={setActiveConvId} setMessages={setMessages}
                setPendingNewMsgCount={setPendingNewMsgCount} openFavoriteMessage={openFavoriteMessage} setFavPreviewVisible={setFavPreviewVisible}
                handleToggleFavorite={handleToggleFavorite} handleTogglePinMessage={handleTogglePinMessage}
              />
            )}
          </Spin>
        </div>
          </>
        )}
        detail={activeChannelId != null && activeChannel ? (
          <ChannelMessageView
            channel={activeChannel}
            currentUserId={currentUserId}
            onBack={() => setActiveChannelId(null)}
            onUnsubscribe={() => { if (activeChannel) void handleUnsubscribeChannel(activeChannel); }}
            onCardAction={handleCardAction}
            onOpenWorkflow={handleOpenWorkflowFromCard}
          />
        ) : activeConv ? (
          <>
          {/* Header */}
          <MasterDetailLayout.Header
            style={isQuick ? undefined : { padding: '8px 20px' }}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!isQuick && (
                  <>
                    {activeConv.type === 'group' && (
                      <Tooltip content="群公告历史">
                        <Button
                          size="small"
                          theme="borderless"
                          type={announcementHistoryVisible ? 'primary' : 'tertiary'}
                          icon={<History size={15} />}
                          onClick={() => {
                            if (!activeConvId) return;
                            setAnnouncementHistoryVisible(true);
                          }}
                        />
                      </Tooltip>
                    )}
                    <Tooltip content={activeConv.type === 'group' ? '群语音通话' : '语音通话'}>
                      <Button
                        size="small"
                        theme="borderless"
                        type="tertiary"
                        icon={<Phone size={15} />}
                        onClick={() => handleStartCall('audio')}
                      />
                    </Tooltip>
                    {activeConv.type === 'direct' && (
                      <Tooltip content="视频通话">
                        <Button
                          size="small"
                          theme="borderless"
                          type="tertiary"
                          icon={<Video size={15} />}
                          onClick={() => handleStartCall('video')}
                        />
                      </Tooltip>
                    )}
                    <NotifySettingsPopover
                      notifyDesktop={notifyDesktop} notifyPermission={notifyPermission} notifySound={notifySound}
                      handleToggleNotifyDesktop={handleToggleNotifyDesktop} handleToggleNotifySound={handleToggleNotifySound}
                    />
                    <Tooltip content={showSearchPanel ? '关闭聊天记录' : '聊天记录'}>
                      <Button
                        size="small"
                        theme="borderless"
                        type={showSearchPanel ? 'primary' : 'tertiary'}
                        icon={<Search size={15} />}
                        onClick={() => {
                          setShowSearchPanel((v) => {
                            const next = !v;
                            if (next) { setShowMembers(false); setShowMediaPanel(false); }
                            return next;
                          });
                        }}
                      />
                    </Tooltip>
                    <Tooltip content={showMediaPanel ? '关闭媒体库' : '图片与文件'}>
                      <Button
                        size="small"
                        theme="borderless"
                        type={showMediaPanel ? 'primary' : 'tertiary'}
                        icon={<Images size={15} />}
                        onClick={() => {
                          setShowMediaPanel((v) => {
                            const next = !v;
                            if (next) { setShowMembers(false); setShowSearchPanel(false); }
                            return next;
                          });
                        }}
                      />
                    </Tooltip>
                    {hasPermission('chat:message:export') && (
                      <Tooltip content="导出聊天记录">
                        <Button
                          size="small"
                          theme="borderless"
                          type="tertiary"
                          icon={<Download size={15} />}
                          loading={exportingChat}
                          onClick={() => { if (activeConvId) void handleExportChat(activeConvId); }}
                        />
                      </Tooltip>
                    )}
                    {activeConv.type === 'group' && (
                      <Tooltip content={showMembers ? '关闭群信息' : '群信息'}>
                        <Button
                          size="small" theme="borderless" type={showMembers ? 'primary' : 'tertiary'}
                          icon={<MoreHorizontal size={15} />}
                          onClick={() => {
                            setShowMembers((v) => {
                              const next = !v;
                              if (next) { setShowSearchPanel(false); setShowMediaPanel(false); }
                              return next;
                            });
                          }}
                        />
                      </Tooltip>
                    )}
                  </>
                )}
                {isQuick && onOpenFullPage && (
                  <Tooltip content="前往聊天页">
                    <Button
                      size="small"
                      theme="borderless"
                      type="tertiary"
                      icon={<ExternalLink size={15} />}
                      onClick={() => onOpenFullPage(activeConvId)}
                    />
                  </Tooltip>
                )}
                {isQuick && onClose && (
                  <Tooltip content="关闭">
                    <Button
                      size="small"
                      theme="borderless"
                      type="tertiary"
                      icon={<X size={15} />}
                      onClick={onClose}
                    />
                  </Tooltip>
                )}
              </div>
            }
          >
            {isQuick && (
              <Tooltip content="返回会话列表">
                <Button
                  size="small"
                  theme="borderless"
                  type="tertiary"
                  icon={<ArrowLeft size={16} />}
                  onClick={() => setActiveConvId(null)}
                />
              </Tooltip>
            )}
            <ChatConvTitle
              activeConv={activeConv} isQuick={isQuick} onlineUserIds={onlineUserIds}
              lastSeenMap={lastSeenMap} groupAvatarMap={groupAvatarMap}
            />
          </MasterDetailLayout.Header>
          <MasterDetailLayout.Body scroll="hidden" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Messages */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', overflow: 'hidden' }}>
              {isInitialLoadingMessages && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin size="middle" />
                </div>
              )}
              {!isInitialLoadingMessages && isEmptyMessagesView && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                  {!wsConnected && <WsDisconnectedBanner />}
                  <Empty description="发送第一条消息吧" imageStyle={{ width: 80 }} />
                </div>
              )}
              {!isInitialLoadingMessages && !isEmptyMessagesView && (
                <Virtuoso
                  ref={virtuosoRef}
                  style={{ flex: 1 }}
                  data={displayMessages}
                  context={virtuosoContext}
                  firstItemIndex={firstItemIndex}
                  initialTopMostItemIndex={Math.max(displayMessages.length - 1, 0)}
                  followOutput={uploadingItems.some((u) => u.convId === activeConvId) ? 'smooth' : false}
                  startReached={handleStartReached}
                  atBottomStateChange={handleAtBottomStateChange}
                  atBottomThreshold={120}
                  increaseViewportBy={{ top: 600, bottom: 200 }}
                  computeItemKey={computeMessageItemKey}
                  components={MESSAGES_VIRTUOSO_COMPONENTS}
                  itemContent={(virtualIndex, msg) => { // NOSONAR
                    const realIndex = virtualIndex - firstItemIndex;
                    const showUnreadDivider = unreadDivider?.convId === activeConvId && unreadDivider.messageId === msg.id;
                    return (
                      <div style={{ padding: isQuick ? '0 12px 16px' : '0 20px 16px' }}>
                        {showUnreadDivider && (
                          <Divider align="center" className="chat-unread-divider" style={{ margin: '4px 0 12px' }}>
                            以下为新消息
                          </Divider>
                        )}
                        <MessageBubble
                          msg={msg}
                          isSelf={msg.senderId === currentUserId}
                          onReply={setReplyTo}
                          onRecall={handleRecall}
                          onOpenImage={handleOpenImageMessage}
                          shouldShowTime={shouldDisplayMessageTime(msg, displayMessages[realIndex + 1])}
                          getReplyMessage={getReplyMessage}
                          onScrollToMessage={scrollToMessage}
                          onToggleFavorite={handleToggleFavorite}
                          onTogglePin={handleTogglePinMessage}
                          onEditRecalled={handleEditRecalled}
                          recalledDraft={recalledDrafts[msg.id]}
                          multiSelectMode={multiSelectMode}
                          isSelected={selectedMessageIds.includes(msg.id)}
                          onToggleSelect={handleToggleSelectMessage}
                          onForwardSingle={handleForwardSingle}
                          onOpenForwardView={handleOpenForwardView}
                          onDeleteMessage={handleDeleteSingle}
                          onReaction={handleReaction}
                          onPickReactionEmoji={handlePickReactionEmoji}
                          currentUserId={currentUserId}
                          onEdit={handleEditMessage}
                          onVote={handleVoteMessage}
                          isHighlighted={highlightedMessageId === msg.id}
                          onSaveAsEmoji={handleSaveAsEmoji}
                          onOpenFilePreview={handleOpenFilePreview}
                          readReceipt={readReceiptMap.get(msg.id)}
                          onCardAction={handleCardAction}
                          onOpenWorkflow={handleOpenWorkflowFromCard}
                        />
                      </div>
                    );
                  }}
                />
              )}
              {/* ⑥ 发送失败重试 */}
              {failedMessages.some((m) => m.convId === activeConvId) && (
                <FailedMessagesList
                  isQuick={isQuick} failedMessages={failedMessages} activeConvId={activeConvId}
                  setFailedMessages={setFailedMessages} setInput={setInput} inputRef={inputRef}
                />
              )}
              {pendingNewMsgCount > 0 && (
                <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                  <Button
                    size="small"
                    theme="solid"
                    type="primary"
                    style={{ pointerEvents: 'auto' }}
                    onClick={() => {
                      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
                      setPendingNewMsgCount(0);
                      if (activeConvId) {
                        void request.post(`/api/chat/conversations/${activeConvId}/read`, {}, { silent: true });
                        setConversations(markConversationReadById(activeConvId));
                      }
                    }}
                  >
                    有 {pendingNewMsgCount} 条新消息，点击查看
                  </Button>
                </div>
              )}
            </div>

            {/* Group members sidebar */}
            {!isQuick && activeConv.type === 'group' && showMembers && !showSearchPanel && !showMediaPanel && (
              <GroupMembersPanel
                conversationId={activeConv.id}
                currentUserId={currentUserId}
                conv={activeConv}
                onlineUserIds={onlineUserIds}
                onConvUpdate={(patch) => {
                  setConversations((prev) =>
                    prev.map((c) => c.id === activeConv.id ? { ...c, ...patch } : c),
                  );
                }}
              />
            )}


            {/* ⑤ 媒体库面板 */}
            {!isQuick && showMediaPanel && !showSearchPanel && !showMembers && (
              <MediaPanel
                setShowMediaPanel={setShowMediaPanel} mediaType={mediaType} setMediaType={setMediaType}
                mediaLoading={mediaLoading} mediaItems={mediaItems} openImagePreview={openImagePreview}
                handleMediaFilePreview={handleMediaFilePreview} activeConvId={activeConvId} fetchMediaItems={fetchMediaItems}
                mediaPage={mediaPage} mediaHasMore={mediaHasMore}
              />
            )}
          </div>

          <ImagePreview
            src={previewSrcList}
            visible={previewVisible}
            currentIndex={previewCurrentIndex}
            onChange={setPreviewCurrentIndex}
            onVisibleChange={(v) => {
              if (!v) {
                previewSessionRef.current += 1;
                setPreviewVisible(false);
                cleanupPreviewBlobs();
                setPreviewSrcList([]);
              }
            }}
            infinite
          />

          <FilePreviewModal
            fileUrl={filePreview?.url ?? ''}
            fileName={filePreview?.name}
            mimeType={filePreview?.mimeType}
            visible={!!filePreview}
            onClose={() => setFilePreview(null)}
          />

          <AnnouncementHistoryModal
            announcementHistoryVisible={announcementHistoryVisible} setAnnouncementHistoryVisible={setAnnouncementHistoryVisible} announcementHistory={announcementHistory}
            isOwnerOfActiveGroup={isOwnerOfActiveGroup} handleDeleteAnnouncementHistory={handleDeleteAnnouncementHistory}
          />

          {/* Input area */}
          <div style={{ padding: isQuick ? '6px 8px' : '4px 8px', borderTop: '1px solid var(--semi-color-border)' }}>
            {multiSelectMode ? (
              <MultiSelectActionBar
                selectedMessageIds={selectedMessageIds} handleForwardSelected={handleForwardSelected} handleFavoriteSelected={handleFavoriteSelected}
                handleDeleteSelected={handleDeleteSelected} handleExitMultiSelect={handleExitMultiSelect}
              />
            ) : (
              <>
            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '4px 10px', background: 'var(--semi-color-fill-0)', borderRadius: 'var(--semi-border-radius-medium)', fontSize: 12, color: 'var(--semi-color-text-2)' }}>
                <CornerDownLeft size={12} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  回复 {replyTo.senderName}：{getReplyPreviewText(replyTo)}
                </span>
                <Button size="small" theme="borderless" type="tertiary" onClick={() => setReplyTo(null)} style={{ padding: '0 4px', height: 'auto', minWidth: 'auto' }}>✕</Button>
              </div>
            )}

            <PendingAttachments
              pendingImages={pendingImages} pendingFiles={pendingFiles} setPreviewSrcList={setPreviewSrcList}
              setPreviewCurrentIndex={setPreviewCurrentIndex} setPreviewVisible={setPreviewVisible} handleRemovePendingImage={handleRemovePendingImage}
              handleRemovePendingFile={handleRemovePendingFile}
            />

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 1, alignItems: 'center' }}>
              <div ref={emojiContainerRef}>
                <Tooltip content="表情">
                  <Button
                    size="small" theme="borderless" type="tertiary"
                    icon={<Smile size={16} />}
                    onClick={() => {
                      if (emojiVisible) { setEmojiVisible(false); return; }
                      const rect = emojiContainerRef.current?.getBoundingClientRect();
                      if (rect) setEmojiAnchor({ top: rect.top, left: rect.left });
                      setEmojiVisible(true);
                    }}
                  />
                </Tooltip>
              </div>
              {emojiVisible && emojiAnchor && (
                <Suspense fallback={null}>
                  <ComposerEmojiPicker
                    emojiPickerRef={emojiPickerRef} emojiAnchor={emojiAnchor} handleEmojiSelect={handleEmojiSelect}
                    sendSticker={sendSticker}
                  />
                </Suspense>
              )}

              <Tooltip content="选择图片">
                <Button
                  size="small" theme="borderless" type="tertiary"
                  icon={<ImagePlus size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                />
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) handleSelectImages(files);
                  e.target.value = '';
                }}
              />
              <Tooltip content="发送文件">
                <Button
                  size="small" theme="borderless" type="tertiary"
                  icon={<Paperclip size={16} />}
                  loading={false}
                  onClick={() => fileAttachRef.current?.click()}
                />
              </Tooltip>
              <Tooltip content="发起投票">
                <Button
                  size="small" theme="borderless" type="tertiary"
                  icon={<BarChart3 size={16} />}
                  onClick={() => setShowVoteModal(true)}
                  disabled={!activeConvId}
                />
              </Tooltip>
              <ComposerExtras
                conversationId={activeConvId}
                draft={input}
                onInsert={(text) => {
                  setInput((prev) => (prev ? `${prev}${text}` : text));
                  inputRef.current?.focus();
                }}
                onScheduled={() => {
                  setInput('');
                  if (activeConvId) saveDraft(activeConvId, '');
                }}
              />
              {voiceRecorder.supported && (
                <Tooltip content="按住说话（点击开始/结束录音）">
                  <Button
                    size="small" theme="borderless" type={voiceRecorder.isRecording ? 'primary' : 'tertiary'}
                    icon={<Mic size={16} />}
                    onClick={() => { if (voiceRecorder.isRecording) voiceRecorder.stop(); else void voiceRecorder.start(); }}
                    disabled={!activeConvId}
                  />
                </Tooltip>
              )}
              {voiceRecorder.isRecording && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4, padding: '2px 10px', borderRadius: 'var(--semi-border-radius-large)', background: 'var(--semi-color-danger-light-default)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--semi-color-danger)', animation: 'qcVoicePulse 1s infinite' }} />
                  <Text style={{ fontSize: 12, color: 'var(--semi-color-danger)', fontVariantNumeric: 'tabular-nums' }}>
                    录音中 {String(Math.floor(voiceRecorder.seconds / 60)).padStart(2, '0')}:{String(voiceRecorder.seconds % 60).padStart(2, '0')} / 01:00
                  </Text>
                  <Button size="small" theme="borderless" type="tertiary" onClick={() => voiceRecorder.cancel()}>取消</Button>
                  <Button size="small" theme="solid" type="primary" icon={<Send size={12} />} onClick={() => voiceRecorder.stop()}>发送</Button>
                </div>
              )}
              <input
                ref={fileAttachRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) handleSelectFile(files);
                  e.target.value = '';
                }}
              />
            </div>

            <div style={{ position: 'relative', flex: 1 }}>
              {mentionState && !mentionClosed && mentionCandidates.length > 0 && (
                <MentionPopup
                  mentionListRef={mentionListRef} mentionCandidates={mentionCandidates} mentionActiveIndex={mentionActiveIndex}
                  setMentionActiveIndex={setMentionActiveIndex} insertMention={insertMention}
                />
              )}
              {Object.values(typingUsers).length > 0 && (
                <TypingIndicator
                  typingUsers={typingUsers}
                />
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); setMentionClosed(false); handleTyping(e.target.value); }}
                onKeyDown={handleKeyDown}
                onPaste={handleInputPaste}
                placeholder={muteState ? muteState.placeholder : '输入消息…'}
                disabled={!!muteState}
                rows={isQuick ? 2 : 3}
                style={{
                  width: '100%', resize: 'none', borderRadius: 'var(--semi-border-radius-medium)', padding: '8px 48px 8px 12px',
                  border: '1px solid var(--semi-color-border)',
                  background: 'var(--semi-color-bg-2)',
                  color: 'var(--semi-color-text-0)',
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                  lineHeight: 1.5, boxSizing: 'border-box',
                  ...(muteState ? { cursor: 'not-allowed', opacity: 0.6 } : {}),
                }}
              />
              <Button
                theme="solid" type="primary"
                icon={<Send size={14} />}
                loading={sending}
                disabled={!!muteState || (!input.trim() && pendingImages.length === 0 && pendingFiles.length === 0)}
                onClick={() => { void handleSend(); }}
                style={{
                  position: 'absolute', bottom: 8, right: 8,
                  borderRadius: 'var(--semi-border-radius-medium)', width: 32, height: 32, padding: 0,
                }}
              />
            </div>
            {!isQuick && (
              <Text type="tertiary" style={{ fontSize: 10, marginTop: 2, display: 'block', opacity: 0.7 }}>Enter 发送 · Shift+Enter 换行 · 支持粘贴图片</Text>
            )}
              </>
            )}
          </div>
          </MasterDetailLayout.Body>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty
              description={<span>选择一个会话开始聊天，<br />或点击右上角「+」新建</span>}
              imageStyle={{ width: 100 }}
            />
          </div>
        )}
      />
      {inviteToken && (
        <JoinInviteModal
          token={inviteToken}
          onClose={() => setInviteToken(null)}
          onJoined={(convId) => {
            void fetchConversations().then(() => {
              setActiveConvId(convId);
              setActiveChannelId(null);
              void fetchMessages(convId);
            });
          }}
        />
      )}
      <DiscoverChannelsModal
        discoverVisible={discoverVisible} setDiscoverVisible={setDiscoverVisible} discoverKeyword={discoverKeyword}
        setDiscoverKeyword={setDiscoverKeyword} discoverList={discoverList} handleSubscribeChannel={handleSubscribeChannel}
      />

      <ForwardModal
        visible={forwardModalVisible}
        conversations={conversations}
        currentConvId={activeConvId}
        onConfirm={(targetIds) => { void handleForwardConfirm(targetIds); }}
        onCancel={() => { setForwardModalVisible(false); setForwardingMessageIds([]); }}
        mode={forwardingMode}
      />
      <VotePollModal
        visible={showVoteModal}
        onClose={() => setShowVoteModal(false)}
        onConfirm={handleCreateVote}
      />
      <WorkflowApprovalDetailSheet
        instanceId={cardSheet?.instanceId ?? null}
        taskId={cardSheet?.taskId ?? null}
        initialAction={cardSheet?.action ?? null}
        visible={!!cardSheet}
        onClose={() => setCardSheet(null)}
        onActionDone={() => {
          if (cardSheet?.messageId) {
            const statusText = cardSheet.action === 'reject' ? '已驳回' : '已处理';
            setMessages(markCardDoneLocal(cardSheet.messageId, statusText));
          } else if (activeConvId) {
            void fetchMessages(activeConvId);
          }
        }}
      />
      {/* Reaction emoji picker — fixed overlay */}
      {reactionPickerVisible && reactionPickerAnchor && (
        <Suspense fallback={null}>
          <ReactionPickerOverlay
            reactionPickerRef={reactionPickerRef} reactionPickerAnchor={reactionPickerAnchor} reactionTargetMsgId={reactionTargetMsgId}
            handleReaction={handleReaction} setReactionPickerVisible={setReactionPickerVisible}
          />
        </Suspense>
      )}
      <ForwardedMessagesModal
        visible={forwardViewVisible}
        items={forwardViewItems}
        title={forwardViewTitle}
        onCancel={() => setForwardViewVisible(false)}
      />
      {favPreviewMsg && (
        <FavoriteMessageModal
          favPreviewMsg={favPreviewMsg} conversations={conversations} favPreviewVisible={favPreviewVisible}
          setFavPreviewVisible={setFavPreviewVisible} handleToggleFavorite={handleToggleFavorite} openFavoriteMessage={openFavoriteMessage}
          handleOpenForwardView={handleOpenForwardView}
        />
      )}

      {/* 聊天记录搜索弹窗 */}
      <MessageSearchModal
        showSearchPanel={showSearchPanel} setShowSearchPanel={setShowSearchPanel} resetSearchFilters={resetSearchFilters}
        searchHasSearched={searchHasSearched} searchTotal={searchTotal} msgSearch={msgSearch}
        setMsgSearch={setMsgSearch} executeSearch={executeSearch} searchTypeFilters={searchTypeFilters}
        setSearchTypeFilters={setSearchTypeFilters} searchSenderId={searchSenderId} setSearchSenderId={setSearchSenderId}
        senderOptions={senderOptions} searchDatePreset={searchDatePreset} applyDatePreset={applyDatePreset}
        setSearchDatePreset={setSearchDatePreset}
        searchTimeRange={searchTimeRange} setSearchTimeRange={setSearchTimeRange} searchLoading={searchLoading}
        searchResults={searchResults} searchPage={searchPage} jumpToSearchResult={jumpToSearchResult}
      />
    </div>
  );
}
