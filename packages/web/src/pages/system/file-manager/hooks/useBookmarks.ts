/** 目录收藏夹（localStorage 持久化，上限 30 条） */
import { useState } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { FM_BOOKMARKS_KEY, loadBookmarks } from '../fs-utils';

export function useBookmarks(currentPath: string) {
  const [bookmarks, setBookmarks] = useState<{ name: string; path: string }[]>(loadBookmarks);

  const persistBookmarks = (next: { name: string; path: string }[]) => {
    setBookmarks(next);
    try { localStorage.setItem(FM_BOOKMARKS_KEY, JSON.stringify(next)); } catch { /* 忽略配额错误 */ }
  };

  const isBookmarked = bookmarks.some((b) => b.path === currentPath);

  const toggleBookmark = () => {
    if (!currentPath) return;
    if (isBookmarked) {
      persistBookmarks(bookmarks.filter((b) => b.path !== currentPath));
      Toast.info({ content: '已取消收藏', duration: 1 });
    } else {
      const name = currentPath.replace(/[/\\]+$/, '').split(/[\\/]/).pop() || currentPath;
      persistBookmarks([{ name, path: currentPath }, ...bookmarks].slice(0, 30));
      Toast.success('已收藏当前目录');
    }
  };

  const removeBookmark = (path: string) => persistBookmarks(bookmarks.filter((x) => x.path !== path));

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark };
}
