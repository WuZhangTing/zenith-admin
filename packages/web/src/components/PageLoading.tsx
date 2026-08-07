import { PREFERENCES_KEY } from '@zenith/shared/core';
import {
  defaultPreferences,
  normalizeLoadingStyle,
  useOptionalPreferences,
} from '@/hooks/usePreferences';
import type { LoadingStyle } from '@/hooks/usePreferences';

function readCachedLoadingStyle(): LoadingStyle {
  if (typeof window === 'undefined') return defaultPreferences.loadingStyle;
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return defaultPreferences.loadingStyle;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultPreferences.loadingStyle;
    }
    const value = (parsed as Record<string, unknown>).loadingStyle;
    return normalizeLoadingStyle(value) ?? defaultPreferences.loadingStyle;
  } catch {
    return defaultPreferences.loadingStyle;
  }
}

export function LoadingIndicator({ variant }: Readonly<{ variant: LoadingStyle }>) {
  return (
    <span
      className={`page-loading-indicator page-loading-indicator--${variant}`}
      data-loading-style={variant}
      aria-hidden="true"
    >
      {variant === 'dots' && (
        <>
          <span className="page-loading__dot" />
          <span className="page-loading__dot" />
          <span className="page-loading__dot" />
        </>
      )}
      {variant === 'ring' && <span className="page-loading__ring" />}
      {variant === 'flip' && <span className="page-loading__flip" />}
      {variant === 'bars' && (
        <>
          <span className="page-loading__bar" />
          <span className="page-loading__bar" />
          <span className="page-loading__bar" />
          <span className="page-loading__bar" />
        </>
      )}
    </span>
  );
}

export default function PageLoading({
  inline = false,
  variant,
  label = '页面加载中',
}: Readonly<{
  inline?: boolean;
  variant?: LoadingStyle;
  label?: string;
}>) {
  const preferencesContext = useOptionalPreferences();
  const preferredStyle = variant
    ?? preferencesContext?.preferences.loadingStyle
    ?? readCachedLoadingStyle();
  const resolvedStyle = normalizeLoadingStyle(preferredStyle) ?? defaultPreferences.loadingStyle;

  return (
    <div
      className={`page-loading${inline ? ' page-loading--inline' : ''}`}
      data-loading-style={resolvedStyle}
      role="status"
      aria-label={label}
    >
      <LoadingIndicator variant={resolvedStyle} />
    </div>
  );
}
