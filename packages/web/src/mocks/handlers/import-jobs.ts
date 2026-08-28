import { http } from 'msw';
import { ok } from '@/mocks/utils/handlers';
import type { ImportEntityMeta } from '@zenith/shared/tasks';
import { mockDateTime } from '../utils/date';

const entities: ImportEntityMeta[] = [
  {
    entity: 'member.members',
    title: '会员',
    module: '会员中心',
    description: '批量导入前台会员账号，自动初始化积分与钱包账户；手机号/邮箱/用户名全局唯一',
    maxRows: 10000,
    columns: [
      { key: 'nickname', header: '昵称', required: true, example: '张三' },
      { key: 'phone', header: '手机号', example: '13800001111' },
      { key: 'email', header: '邮箱' },
      { key: 'username', header: '用户名' },
      { key: 'password', header: '初始密码' },
      { key: 'level', header: '等级名称' },
      { key: 'status', header: '状态', enumValues: ['正常', '未激活', '已封禁'] },
      { key: 'remark', header: '备注' },
    ],
  },
];

let nextImportTaskId = 9000;

export const importJobsHandlers = [
  http.get('/api/import-jobs/entities', () => ok(entities)),
  http.post('/api/import-jobs', () => {
    const now = mockDateTime();
    const id = nextImportTaskId++;
    return ok({
      id, taskType: 'data-import', title: '会员导入（demo.xlsx）', module: '导入中心',
      status: 'success', payload: {}, totalCount: 3, processedCount: 3, failedCount: 1,
      progressNote: '成功 2 / 失败 1（共 3 行）', result: { total: 3, succeeded: 2, failed: 1 },
      errorMessage: null, cancelRequested: false, attempts: 1, maxAttempts: 1, nextRunAt: null,
      createdBy: 1, createdByName: '管理员', tenantId: null, traceId: null,
      startedAt: now, completedAt: now, createdAt: now, updatedAt: now,
    }, '导入任务已提交，可在任务中心查看进度与行级明细');
  }),
];
