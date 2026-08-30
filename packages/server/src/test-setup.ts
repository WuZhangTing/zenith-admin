/**
 * 全局测试 setup（vitest.config.ts → setupFiles，每个测试文件执行前运行一次）。
 *
 * 只做一件事：把模块加载期就发起真实 TCP 连接的 `lib/redis` 替换成内存替身，
 * 原因与替身语义见 test-utils/redis-stub.ts。这里的 vi.mock 以本文件为基准
 * 解析路径，对所有测试文件生效；单个文件自己的 vi.mock('../lib/redis', ...)
 * 会覆盖此处（后注册者生效），既有断言调用细节的测试不受影响。
 */
import { vi } from 'vitest';
import { createRedisStub } from './test-utils/redis-stub';

vi.mock('./lib/redis', () => ({ default: createRedisStub(), closeRedis: vi.fn() }));
