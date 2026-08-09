import { describe, expect, it } from 'vitest';
import { lookupIpRegion } from './ip-region';

describe('lookupIpRegion', () => {
  it('normalizes forwarded private IP addresses', () => {
    expect(lookupIpRegion('10.0.0.8, 203.0.113.1')).toMatchObject({
      isPrivate: true,
      country: '',
      province: '',
      city: '',
      isp: '',
    });
  });

  it('returns null for an empty address', () => {
    expect(lookupIpRegion('')).toBeNull();
    expect(lookupIpRegion(null)).toBeNull();
  });
});
