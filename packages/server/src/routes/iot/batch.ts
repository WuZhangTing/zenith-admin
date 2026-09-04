/**
 * IoT 批量操作 API（/api/iot/batch）：提交批量指令 / 批量期望属性任务。
 *
 * 目标集在提交时展开（deviceIds ∪ groupId 成员），任务中心负责进度/重试/取消；
 * 设备名快照随 payload 传递供行级明细展示。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { commonErrorResponses, jsonContent, ok, okBody, validationHook } from '../../lib/openapi-schemas';
import { mapAsyncTask, submitAsyncTask } from '../../lib/task-center';
import { iotBatchCommandSchema, iotBatchDesiredSchema, IOT_BATCH_DEVICE_MAX } from '@zenith/shared/iot';
import { asyncTaskSchema } from '@zenith/shared/tasks';
import { resolveIotBatchTargets } from '../../services/iot/iot-groups.service';

const iotBatchRouter = new OpenAPIHono({ defaultHook: validationHook });

const batchCommandRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/commands',
    tags: ['IoT 设备'], summary: '批量下发指令（任务中心执行，行级明细可见）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:batch',
      audit: { description: '批量下发 IoT 指令', module: 'IoT 设备' },
    })] as const,
    request: { body: { content: jsonContent(iotBatchCommandSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(asyncTaskSchema, '任务已提交') },
  }),
  handler: async (c) => {
    const input = c.req.valid('json');
    const targets = await resolveIotBatchTargets(input.deviceIds, input.groupId, IOT_BATCH_DEVICE_MAX);
    const row = await submitAsyncTask({
      taskType: 'iot-batch-command',
      title: `批量下发指令 ${input.service}（${targets.deviceIds.length} 台）`,
      payload: {
        deviceIds: targets.deviceIds,
        deviceNames: targets.deviceNames,
        service: input.service,
        params: input.params ?? null,
        ttlSeconds: input.ttlSeconds,
      },
    });
    return c.json(okBody(mapAsyncTask(row), '批量任务已提交，可在任务中心查看进度'), 200);
  },
});

const batchDesiredRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/desired',
    tags: ['IoT 设备'], summary: '批量设置期望属性（任务中心执行）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:batch',
      audit: { description: '批量设置 IoT 期望属性', module: 'IoT 设备' },
    })] as const,
    request: { body: { content: jsonContent(iotBatchDesiredSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(asyncTaskSchema, '任务已提交') },
  }),
  handler: async (c) => {
    const input = c.req.valid('json');
    const targets = await resolveIotBatchTargets(input.deviceIds, input.groupId, IOT_BATCH_DEVICE_MAX);
    const row = await submitAsyncTask({
      taskType: 'iot-batch-desired',
      title: `批量设置期望属性（${targets.deviceIds.length} 台）`,
      payload: {
        deviceIds: targets.deviceIds,
        deviceNames: targets.deviceNames,
        desired: input.desired,
      },
    });
    return c.json(okBody(mapAsyncTask(row), '批量任务已提交，可在任务中心查看进度'), 200);
  },
});

iotBatchRouter.openapiRoutes([batchCommandRoute, batchDesiredRoute] as const);

export default iotBatchRouter;
