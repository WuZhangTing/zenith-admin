import { Sun, Moon, Monitor } from 'lucide-react';
import type { ThemeMode } from '@/hooks/useTheme';

// 主题图标
export function SunIcon() {
  return <Sun size={16} strokeWidth={1.5} />;
}

export function MoonIcon() {
  return <Moon size={16} strokeWidth={1.5} />;
}

export function MonitorIcon() {
  return <Monitor size={16} strokeWidth={1.5} />;
}

export const themeLabelMap: Record<ThemeMode, { label: string; icon: React.ReactNode }> = {
  light: { label: '浅色', icon: <SunIcon /> },
  dark:  { label: '深色', icon: <MoonIcon /> },
  system: { label: '跟随系统', icon: <MonitorIcon /> },
};
