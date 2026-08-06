/**
 * 跨域基础契约：统一响应包络、分页、通用状态与存储 key
 *
 * 用法：import { Xxx } from '@zenith/shared/core'
 * 注意：本入口刻意不导出种子数据，seed 请走 '@zenith/shared/seed'。
 */
export * from './constants';
export * from './enum-options';
export * from './json-shape';
export * from './types';
export * from './validation';
