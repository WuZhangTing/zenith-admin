import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ip2Region = require('node-ip2region') as {
  create: () => {
    btreeSearchSync: (ip: string) => { city: number; region: string } | null;
  };
};

export interface IpRegion {
  isPrivate: boolean;
  country: string;
  province: string;
  city: string;
  isp: string;
}

let searcher: ReturnType<typeof Ip2Region.create> | null = null;

function getSearcher() {
  searcher ??= Ip2Region.create();
  return searcher;
}

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', 'localhost']);

function isPrivateIp(ip: string): boolean {
  return (
    LOCALHOST_IPS.has(ip)
    || ip.startsWith('::ffff:127.')
    || ip.startsWith('192.168.')
    || ip.startsWith('10.')
    || ip.startsWith('172.')
  );
}

export function lookupIpRegion(ip: string | null | undefined): IpRegion | null {
  if (!ip) return null;
  const cleaned = ip.split(',')[0].trim();
  if (isPrivateIp(cleaned)) {
    return {
      isPrivate: true,
      country: '',
      province: '',
      city: '',
      isp: '',
    };
  }

  try {
    const result = getSearcher().btreeSearchSync(cleaned);
    if (!result?.region) return null;
    const parts = result.region.split('|').map((part) => part === '0' ? '' : part);
    return {
      isPrivate: false,
      country: parts[0] ?? '',
      province: parts[2] ?? '',
      city: parts[3] ?? '',
      isp: parts[4] ?? '',
    };
  } catch {
    return null;
  }
}
