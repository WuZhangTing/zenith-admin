export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

const priorityTimezones = [DEFAULT_TIMEZONE, 'UTC'];
const supportedTimezones = Intl.supportedValuesOf('timeZone')
  .filter((timezone) => !priorityTimezones.includes(timezone));

export const IANA_TIMEZONE_OPTIONS = [...priorityTimezones, ...supportedTimezones]
  .map((timezone) => ({ value: timezone, label: timezone }));
