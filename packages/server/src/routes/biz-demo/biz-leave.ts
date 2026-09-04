import { OpenAPIHono } from '@hono/zod-openapi';
import { bizLeaveContract } from '@zenith/shared/biz';
import { authMiddleware } from '../../middleware/auth';
import { idempotencyGuard } from '../../middleware/idempotency';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  listBizLeaves, getBizLeave, getBizLeaveDetail, createBizLeave, updateBizLeave, deleteBizLeave, submitBizLeave, reopenBizLeave,
} from '../../services/biz-demo/biz-leave.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const authed = [authMiddleware] as const;

const listRoute = defineContractRoute(bizLeaveContract.list, {
  middleware: authed,
  handler: async (c) => c.json(okBody(await listBizLeaves(c.req.valid('query'))), 200),
});

const getRoute = defineContractRoute(bizLeaveContract.detail, {
  middleware: authed,
  handler: async (c) => c.json(okBody(await getBizLeave(c.req.valid('param').id)), 200),
});

const detailRoute = defineContractRoute(bizLeaveContract.approvalDetail, {
  middleware: authed,
  handler: async (c) => c.json(okBody(await getBizLeaveDetail(c.req.valid('param').id)), 200),
});

const createRouteDef = defineContractRoute(bizLeaveContract.create, {
  middleware: authed,
  handler: async (c) => c.json(okBody(await createBizLeave(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineContractRoute(bizLeaveContract.update, {
  middleware: authed,
  handler: async (c) => c.json(okBody(await updateBizLeave(c.req.valid('param').id, c.req.valid('json')), '更新成功'), 200),
});

const deleteRouteDef = defineContractRoute(bizLeaveContract.remove, {
  middleware: authed,
  handler: async (c) => {
    await deleteBizLeave(c.req.valid('param').id);
    return c.json(okBody(null, '已删除'), 200);
  },
});

const submitRoute = defineContractRoute(bizLeaveContract.submit, {
  middleware: [authMiddleware, idempotencyGuard({ ttlSeconds: 10 })],
  handler: async (c) => c.json(okBody(await submitBizLeave(c.req.valid('param').id), '已提交审批'), 200),
});

const reopenRoute = defineContractRoute(bizLeaveContract.reopen, {
  middleware: authed,
  handler: async (c) => c.json(okBody(await reopenBizLeave(c.req.valid('param').id), '已转为草稿'), 200),
});

router.openapiRoutes([listRoute, getRoute, detailRoute, createRouteDef, updateRouteDef, deleteRouteDef, submitRoute, reopenRoute] as const);

export default router;
