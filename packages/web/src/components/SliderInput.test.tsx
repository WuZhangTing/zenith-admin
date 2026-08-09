import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SliderInput } from './SliderInput';

describe('SliderInput', () => {
  it('keeps the slider and number input on the same value', () => {
    const onChange = vi.fn();
    render(
      <SliderInput
        value={45}
        onChange={onChange}
        min={0}
        max={100}
        suffix="%"
        aria-label="水印不透明度"
      />,
    );

    expect(screen.getByRole('slider', { name: '水印不透明度' }).getAttribute('aria-valuenow')).toBe('45');
    const input = screen.getByRole('spinbutton', { name: '水印不透明度精确值' });
    expect(input.getAttribute('value')).toBe('45');

    fireEvent.change(input, { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('clamps values entered outside the configured range', () => {
    const onChange = vi.fn();
    render(<SliderInput value={50} onChange={onChange} min={0} max={100} aria-label="参与流量" />);

    fireEvent.change(screen.getByRole('spinbutton', { name: '参与流量精确值' }), {
      target: { value: '120' },
    });
    expect(onChange).toHaveBeenCalledWith(100);
  });
});
