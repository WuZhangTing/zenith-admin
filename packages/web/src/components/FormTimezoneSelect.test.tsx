import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TIMEZONE, IANA_TIMEZONE_OPTIONS } from '@/utils/timezones';
import { FormTimezoneSelect } from './FormTimezoneSelect';

const selectPropsSpy = vi.hoisted(() => vi.fn());

vi.mock('@douyinfe/semi-ui', () => ({
  Form: {
    Select: (props: unknown) => {
      selectPropsSpy(props);
      return null;
    },
  },
}));

describe('FormTimezoneSelect', () => {
  it('uses the shared searchable IANA options and required validation by default', () => {
    render(<FormTimezoneSelect />);

    expect(selectPropsSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      field: 'timezone',
      label: '时区',
      filter: true,
      showClear: true,
      optionList: IANA_TIMEZONE_OPTIONS,
      placeholder: '请选择时区',
      rules: [{ required: true, message: '请选择时区' }],
    });
  });

  it('supports optional timezone fields with the shared default hint', () => {
    render(<FormTimezoneSelect field="resetTimezone" label="重置时区" required={false} />);

    const props = selectPropsSpy.mock.calls.at(-1)?.[0] as { rules?: unknown };
    expect(props).toMatchObject({
      field: 'resetTimezone',
      label: '重置时区',
      placeholder: `默认 ${DEFAULT_TIMEZONE}`,
      extraText: `留空使用 ${DEFAULT_TIMEZONE}`,
    });
    expect(props.rules).toBeUndefined();
  });
});
