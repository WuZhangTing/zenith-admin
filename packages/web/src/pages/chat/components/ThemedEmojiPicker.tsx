import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useThemeController } from '@/providers/theme-controller';

export function ThemedEmojiPicker({
  onEmojiSelect,
}: Readonly<{
  onEmojiSelect: (emoji: { native: string }) => void;
}>) {
  const { isDark } = useThemeController();

  return (
    <Picker
      data={data}
      onEmojiSelect={onEmojiSelect}
      theme={isDark ? 'dark' : 'light'}
      locale="zh"
      previewPosition="none"
      skinTonePosition="none"
    />
  );
}
