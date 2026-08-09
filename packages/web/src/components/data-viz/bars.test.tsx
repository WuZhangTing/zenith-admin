import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataBar } from './DataBar';
import { MetricMeter } from './MetricMeter';

describe('MetricMeter', () => {
  it('exposes bounded meter semantics and preserves display text', () => {
    render(<MetricMeter value={135} label="CPU 使用率" valueText="135%" />);

    const meter = screen.getByRole('meter', { name: 'CPU 使用率' });
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('100');
    expect(meter.getAttribute('aria-valuenow')).toBe('100');
    expect(meter.getAttribute('aria-valuetext')).toBe('135%');
  });
});

describe('DataBar', () => {
  it('is decorative and clamps relative values', () => {
    const { container } = render(<DataBar value={25} max={100} minPercent={4} />);
    const bar = container.querySelector('.zx-data-bar');

    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect((bar as HTMLElement).style.getPropertyValue('--zx-bar-scale')).toBe('0.25');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('meter')).toBeNull();
  });
});
