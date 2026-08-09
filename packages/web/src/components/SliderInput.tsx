import type { CSSProperties, ReactNode } from 'react';
import { InputNumber, Slider, withField } from '@douyinfe/semi-ui';

export interface SliderInputProps {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  marks?: Record<number, string>;
  showBoundary?: boolean;
  suffix?: ReactNode;
  precision?: number;
  inputWidth?: number;
  tipFormatter?: (value: string | number | boolean | null | Array<string | number | boolean | null>) => ReactNode;
  getAriaValueText?: (value: number, index?: number) => string;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

export function SliderInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  marks,
  showBoundary,
  suffix,
  precision,
  inputWidth = 96,
  tipFormatter,
  getAriaValueText,
  'aria-label': ariaLabel,
  className,
  style,
}: Readonly<SliderInputProps>) {
  const current = Number.isFinite(value) ? Number(value) : min;
  const updateValue = (next: unknown) => {
    if (Array.isArray(next)) return;
    const numeric = Number(next);
    if (!Number.isFinite(numeric)) return;
    onChange?.(Math.min(max, Math.max(min, numeric)));
  };

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', ...style }}>
      <div style={{ flex: 1, minWidth: 80 }}>
        <Slider
          value={current}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          marks={marks}
          showBoundary={showBoundary}
          tipFormatter={tipFormatter}
          getAriaValueText={getAriaValueText}
          aria-label={ariaLabel}
          onChange={updateValue}
        />
      </div>
      <InputNumber
        value={current}
        min={min}
        max={max}
        step={step}
        precision={precision}
        suffix={suffix}
        disabled={disabled}
        style={{ width: inputWidth, flexShrink: 0 }}
        aria-label={ariaLabel ? `${ariaLabel}精确值` : undefined}
        onChange={updateValue}
      />
    </div>
  );
}

export const FormSliderInput = withField(SliderInput);
