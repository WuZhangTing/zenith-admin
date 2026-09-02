import { describe, expect, it } from 'vitest';
import { resolveEffectivelyEnabledChannelIds } from './cms-channel-visibility.service';

describe('CMS effective channel visibility', () => {
  it('requires the channel and every ancestor to be enabled', () => {
    const rows = [
      { id: 1, parentId: 0, status: 'enabled' as const },
      { id: 2, parentId: 1, status: 'enabled' as const },
      { id: 3, parentId: 2, status: 'disabled' as const },
      { id: 4, parentId: 3, status: 'enabled' as const },
      { id: 5, parentId: 99, status: 'enabled' as const },
    ];
    expect(resolveEffectivelyEnabledChannelIds(rows)).toEqual(new Set([1, 2]));
  });

  it('fails closed on parent cycles', () => {
    expect(resolveEffectivelyEnabledChannelIds([
      { id: 1, parentId: 2, status: 'enabled' },
      { id: 2, parentId: 1, status: 'enabled' },
    ])).toEqual(new Set());
  });
});
