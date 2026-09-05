import { OpenAPIHono } from '@hono/zod-openapi';
import { analyticsCampaignContract } from '@zenith/shared/analytics';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { okBody, validationHook } from '../../lib/openapi-schemas';
import { listCampaigns, createCampaign, updateCampaign, deleteCampaign, executeCampaign } from '../../services/analytics/analytics-campaigns.service';
import { mapAsyncTask } from '../../lib/task-center';

const r = new OpenAPIHono({ defaultHook: validationHook });

const campaignListRoute = defineContractRoute(analyticsCampaignContract.campaigns, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage' })],
  handler: async (c) => c.json(okBody(await listCampaigns(c.req.valid('query'))), 200),
});

const campaignCreateRoute = defineContractRoute(analyticsCampaignContract.createCampaign, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '创建分群触达活动' } })],
  handler: async (c) => c.json(okBody(await createCampaign(c.req.valid('json')), '创建成功'), 200),
});

const campaignUpdateRoute = defineContractRoute(analyticsCampaignContract.updateCampaign, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '更新分群触达活动' } })],
  handler: async (c) => c.json(okBody(await updateCampaign(c.req.valid('param').id, c.req.valid('json')), '更新成功'), 200),
});

const campaignDeleteRoute = defineContractRoute(analyticsCampaignContract.removeCampaign, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '删除分群触达活动' } })],
  handler: async (c) => {
    await deleteCampaign(c.req.valid('param').id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const campaignExecuteRoute = defineContractRoute(analyticsCampaignContract.executeCampaign, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '提交分群触达任务' } })],
  handler: async (c) => c.json(okBody(mapAsyncTask(await executeCampaign(c.req.valid('param').id)), '任务已提交，可在任务中心查看进度'), 200),
});

r.openapiRoutes([
  campaignListRoute,
  campaignCreateRoute,
  campaignUpdateRoute,
  campaignDeleteRoute,
  campaignExecuteRoute,
] as const);

export default r;
