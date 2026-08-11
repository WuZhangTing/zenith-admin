import { describe, it, expect } from 'vitest';
import { deriveTriggerExecutionStatus } from './workflow-trigger-executions.service';

type Job = Parameters<typeof deriveTriggerExecutionStatus>[0];
type Execution = NonNullable<Parameters<typeof deriveTriggerExecutionStatus>[1]>;

const job = (status: Job['status'], attempts: number, maxAttempts = 3): Job =>
  ({ status, attempts, maxAttempts });
const exec = (status: Execution['status']): Execution => ({ status });

describe('deriveTriggerExecutionStatus', () => {
  it('作业或本次尝试成功即为 success', () => {
    expect(deriveTriggerExecutionStatus(job('succeeded', 1))).toBe('success');
    expect(deriveTriggerExecutionStatus(job('running', 1), exec('succeeded'))).toBe('success');
  });

  it('执行中优先于重试预算判定', () => {
    expect(deriveTriggerExecutionStatus(job('running', 1))).toBe('running');
    expect(deriveTriggerExecutionStatus(job('pending', 1), exec('running'))).toBe('running');
  });

  it('尚未尝试过为 pending', () => {
    expect(deriveTriggerExecutionStatus(job('pending', 0))).toBe('pending');
  });

  it('已尝试且仍有预算为 retrying——失败待重排与退避窗口内的 pending 同为此状态', () => {
    expect(deriveTriggerExecutionStatus(job('failed', 1), exec('failed'))).toBe('retrying');
    expect(deriveTriggerExecutionStatus(job('pending', 1), exec('failed'))).toBe('retrying');
  });

  it('预算耗尽为终态 failed', () => {
    expect(deriveTriggerExecutionStatus(job('failed', 3), exec('failed'))).toBe('failed');
    expect(deriveTriggerExecutionStatus(job('failed', 4), exec('failed'))).toBe('failed');
  });

  it('死信与取消均为终态 failed，不因剩余预算回落到 retrying', () => {
    expect(deriveTriggerExecutionStatus(job('dead', 1))).toBe('failed');
    expect(deriveTriggerExecutionStatus(job('canceled', 0))).toBe('failed');
  });

  it('缺少执行行时仅按作业状态判定', () => {
    expect(deriveTriggerExecutionStatus(job('failed', 2))).toBe('retrying');
    expect(deriveTriggerExecutionStatus(job('succeeded', 1), null)).toBe('success');
  });
});
