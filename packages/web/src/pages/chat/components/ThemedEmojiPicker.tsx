import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useThemeController } from '@/providers/theme-controller';

const PICKER_WIDTH = 352;
const PICKER_HEIGHT = 435;

export function ThemedEmojiPicker({
  onEmojiSelect,
}: Readonly<{
  onEmojiSelect: (emoji: { native: string }) => void;
}>) {
  const { isDark } = useThemeController();

  return (
    // Emoji Mart mounts its custom element in an effect, so reserve its default size before initialization.
    <div style={{ width: PICKER_WIDTH, height: PICKER_HEIGHT }}>
      <Picker
        data={data}
        onEmojiSelect={onEmojiSelect}
        theme={isDark ? 'dark' : 'light'}
        locale="zh"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
}
