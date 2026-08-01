import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import type { Setter } from '../types';

/** 消息表情回应选择浮层（自 ChatPage 原样搬移） */
export function ReactionPickerOverlay({
  reactionPickerRef, reactionPickerAnchor, reactionTargetMsgId, handleReaction, setReactionPickerVisible,
}: Readonly<{
  reactionPickerRef: React.RefObject<HTMLDivElement | null>;
  reactionPickerAnchor: { top: number; right: number };
  reactionTargetMsgId: number | null;
  handleReaction: (messageId: number, emoji: string) => void;
  setReactionPickerVisible: Setter<boolean>;
}>) {
  return (
        <div
          ref={reactionPickerRef}
          style={{
            position: 'fixed',
            bottom: window.innerHeight - reactionPickerAnchor.top + 4,
            right: reactionPickerAnchor.right,
            zIndex: 9999,
          }}
        >
          <Picker
            data={data}
            onEmojiSelect={(emoji: { native: string }) => {
              if (reactionTargetMsgId !== null) handleReaction(reactionTargetMsgId, emoji.native);
              setReactionPickerVisible(false);
            }}
            theme="auto"
            locale="zh"
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
  );
}
