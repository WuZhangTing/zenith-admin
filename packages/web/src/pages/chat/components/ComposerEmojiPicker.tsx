import { TabPane, Tabs } from '@douyinfe/semi-ui';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import type { ChatCustomEmoji } from '@zenith/shared/chat';
import { StickerPanel } from './StickerPanel';

/** 输入区表情选择浮层：emoji + 收藏贴纸两个 Tab（自 ChatPage 原样搬移） */
export function ComposerEmojiPicker({
  emojiPickerRef, emojiAnchor, handleEmojiSelect, sendSticker,
}: Readonly<{
  emojiPickerRef: React.RefObject<HTMLDivElement | null>;
  emojiAnchor: { top: number; left: number };
  handleEmojiSelect: (emoji: { native: string }) => void;
  sendSticker: (emoji: ChatCustomEmoji) => Promise<void>;
}>) {
  return (
                <div
                  ref={emojiPickerRef}
                  style={{
                    position: 'fixed',
                    bottom: window.innerHeight - emojiAnchor.top + 4,
                    left: emojiAnchor.left,
                    zIndex: 9999,
                    background: 'var(--semi-color-bg-3)',
                    borderRadius: 'var(--semi-border-radius-large)',
                    boxShadow: 'var(--semi-shadow-elevated)',
                    overflow: 'hidden',
                  }}
                >
                  <Tabs size="small" type="line" tabPaneMotion={false} style={{ padding: '0 8px' }}>
                    <TabPane tab="表情" itemKey="emoji">
                      <Picker
                        data={data}
                        onEmojiSelect={handleEmojiSelect}
                        theme="auto"
                        locale="zh"
                        previewPosition="none"
                        skinTonePosition="none"
                      />
                    </TabPane>
                    <TabPane tab="收藏" itemKey="stickers">
                      <StickerPanel onSelect={(emoji) => { void sendSticker(emoji); }} />
                    </TabPane>
                  </Tabs>
                </div>
  );
}
