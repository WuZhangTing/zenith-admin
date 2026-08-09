/**
 * IP 地理位置解析工具（基于 ip2region 本地库）
 * 格式："省份 城市 ISP"，localhost 返回 "内网地址"
 */

import { lookupIpRegion } from './ip-region';

/**
 * 将 IP 地址解析为可读地理位置字符串。
 * @returns 如 "广东省 深圳市 联通"，解析失败返回 null
 */
export function lookupIpLocation(ip: string): string | null {
  const region = lookupIpRegion(ip);
  if (!region) return null;
  if (region.isPrivate) return '内网地址';
  if (region.country === '中国') {
    return [region.province, region.city, region.isp].filter(Boolean).join(' ') || '中国';
  }
  return [region.country, region.province, region.city].filter(Boolean).join(' ') || null;
}
