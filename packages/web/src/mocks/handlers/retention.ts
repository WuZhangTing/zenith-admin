import { http } from 'msw';
import type { RetentionPolicy } from '@zenith/shared/ops';
import { ok, notFound } from '@/mocks/utils/handlers';
import { mockDateTime } from '../utils/date';

const policies: RetentionPolicy[] = [
  {
    key: 'operation_logs',
    title: '操作日志',
    module: '系统管理',
    tableName: 'operation_logs',
    timeColumn: 'created_at',
    mode: 'age',
    enabled: true,
    retentionDays: 180,
    defaultRetentionDays: 180,
    batchSize: 5000,
    perTenant: false,
    capColumn: null,
    capLimit: null,
    description: '后台写操作的审计留痕，含变更前后快照与响应体，单行体积较大。',
    lastRunAt: '2026-08-10 03:00:12',
    lastDeleted: 12_480,
  },
  {
    key: 'login_logs',
    title: '登录日志',
    module: '系统管理',
    tableName: 'login_logs',
    timeColumn: 'created_at',
    mode: 'age',
    enabled: true,
    retentionDays: 180,
    defaultRetentionDays: 180,
    batchSize: 5000,
    perTenant: false,
    capColumn: null,
    capLimit: null,
    description: '管理端登录 / 登出记录。',
    lastRunAt: '2026-08-10 03:00:14',
    lastDeleted: 3210,
  },
  {
    key: 'system_scheduler_runs',
    title: '系统调度运行日志',
    module: '系统调度',
    tableName: 'system_scheduler_runs',
    timeColumn: 'started_at',
    mode: 'ageAndCap',
    enabled: true,
    retentionDays: 30,
    defaultRetentionDays: 30,
    batchSize: 5000,
    perTenant: false,
    capColumn: 'task_name',
    capLimit: 1000,
    description: '系统级周期任务的运行记录；按时间裁剪后每个任务再保留最近 1000 条。',
    lastRunAt: '2026-08-10 03:00:15',
    lastDeleted: 860,
  },
  {
    key: 'user_events',
    title: '行为埋点事件',
    module: '数据分析',
    tableName: 'user_events',
    timeColumn: 'created_at',
    mode: 'age',
    enabled: true,
    retentionDays: 180,
    defaultRetentionDays: 180,
    batchSize: 5000,
    perTenant: true,
    capColumn: null,
    capLimit: null,
    description: '原始埋点事件，增长最快的表之一；各租户可在数据分析设置中单独指定保留天数。',
    lastRunAt: '2026-08-10 03:01:02',
    lastDeleted: 254_900,
  },
  {
    key: 'payment_notify_logs',
    title: '支付回调日志',
    module: '支付中心',
    tableName: 'payment_notify_logs',
    timeColumn: 'created_at',
    mode: 'age',
    enabled: true,
    retentionDays: 365,
    defaultRetentionDays: 365,
    batchSize: 5000,
    perTenant: false,
    capColumn: null,
    capLimit: null,
    description: '渠道异步回调原始报文，用于对账与纠纷举证。',
    lastRunAt: null,
    lastDeleted: 0,
  },
  {
    key: 'maintenance_logs',
    title: '维护记录',
    module: '系统管理',
    tableName: 'maintenance_logs',
    timeColumn: 'created_at',
    mode: 'age',
    enabled: false,
    retentionDays: 0,
    defaultRetentionDays: 365,
    batchSize: 5000,
    perTenant: false,
    capColumn: null,
    capLimit: null,
    description: '维护模式开启至关闭的时段记录。',
    lastRunAt: null,
    lastDeleted: 0,
  },
];

function findPolicy(key: string) {
  return policies.find((item) => item.key === key);
}

export const retentionHandlers = [
  http.get('/api/retention-policies', () => ok(policies)),

  http.put('/api/retention-policies/:key', async ({ params, request }) => {
    const policy = findPolicy(String(params.key));
    if (!policy) return notFound('保留策略不存在', { status: 404 });
    const body = await request.json() as Partial<RetentionPolicy>;
    if (body.enabled !== undefined) policy.enabled = body.enabled;
    if (body.retentionDays !== undefined) policy.retentionDays = body.retentionDays;
    if (body.batchSize !== undefined) policy.batchSize = body.batchSize;
    return ok(policy);
  }),

  http.get('/api/retention-policies/:key/preview', ({ params }) => {
    const policy = findPolicy(String(params.key));
    if (!policy) return notFound('保留策略不存在', { status: 404 });
    if (policy.retentionDays === 0) {
      return ok({ key: policy.key, pending: 0, cutoff: null });
    }
    const cutoff = new Date(Date.now() - policy.retentionDays * 86_400_000);
    return ok({
      key: policy.key,
      pending: Math.floor(Math.random() * 5000),
      cutoff: cutoff.toISOString().slice(0, 19).replace('T', ' '),
    });
  }),

  http.post('/api/retention-policies/:key/run', ({ params }) => {
    const policy = findPolicy(String(params.key));
    if (!policy) return notFound('保留策略不存在', { status: 404 });
    const deleted = policy.retentionDays === 0 ? 0 : Math.floor(Math.random() * 2000);
    policy.lastRunAt = mockDateTime();
    policy.lastDeleted = deleted;
    return ok({ key: policy.key, deleted }, `已清理 ${deleted} 行`);
  }),
];
