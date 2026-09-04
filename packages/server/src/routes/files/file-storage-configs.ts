import { OpenAPIHono } from '@hono/zod-openapi';
import { fileStorageConfigContract } from '@zenith/shared/platform';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { ErrorResponse, jsonContent, okBody, validationHook } from '../../lib/openapi-schemas';
import {
  listFileStorageConfigs,
  getDefaultFileStorageConfig,
  createFileStorageConfig,
  updateFileStorageConfig,
  setDefaultFileStorageConfig,
  deleteFileStorageConfig,
  getFileStorageConfigBeforeAudit,
  getFileStorageConfig,
  testFileStorageConfig,
  testExistingFileStorageConfig,
} from '../../services/files/file-storage-configs.service';

const fileStorageConfigsRouter = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'system:file:config' })] as const;

const testFailedResponse = { 400: { content: jsonContent(ErrorResponse), description: '测试失败' } } as const;

const listRoute = defineContractRoute(fileStorageConfigContract.list, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listFileStorageConfigs(c.req.valid('query'))), 200),
});

const defaultRoute = defineContractRoute(fileStorageConfigContract.defaultConfig, {
  middleware: read,
  handler: async (c) => c.json(okBody(await getDefaultFileStorageConfig()), 200),
});

const getOneRoute = defineContractRoute(fileStorageConfigContract.detail, {
  middleware: read,
  handler: async (c) => c.json(okBody(await getFileStorageConfig(c.req.valid('param').id)), 200),
});

const testRoute = defineContractRoute(fileStorageConfigContract.test, {
  middleware: [authMiddleware, guard({ permission: 'system:file:config', audit: { description: '测试文件存储连接', module: '文件存储配置', recordBody: false } })],
  responses: testFailedResponse,
  handler: async (c) => {
    const result = await testFileStorageConfig(c.req.valid('json'));
    return c.json(okBody(null, result.message), 200);
  },
});

const testExistingRoute = defineContractRoute(fileStorageConfigContract.testExisting, {
  middleware: [authMiddleware, guard({ permission: 'system:file:config', audit: { description: '测试文件存储连接', module: '文件存储配置', recordBody: false } })],
  responses: testFailedResponse,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const result = await testExistingFileStorageConfig(id, c.req.valid('json'));
    return c.json(okBody(null, result.message), 200);
  },
});

const createRouteDef = defineContractRoute(fileStorageConfigContract.create, {
  middleware: [authMiddleware, guard({ permission: 'system:file:config:create', audit: { description: '创建文件存储配置', module: '文件存储配置' } })],
  handler: async (c) => c.json(okBody(await createFileStorageConfig(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineContractRoute(fileStorageConfigContract.update, {
  middleware: [authMiddleware, guard({ permission: 'system:file:config:update', audit: { description: '更新文件存储配置', module: '文件存储配置' } })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getFileStorageConfigBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateFileStorageConfig(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const setDefaultRoute = defineContractRoute(fileStorageConfigContract.setDefault, {
  middleware: [authMiddleware, guard({ permission: 'system:file:config:default', audit: { description: '设置默认文件存储', module: '文件存储配置', recordBody: false } })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getFileStorageConfigBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await setDefaultFileStorageConfig(id), '默认文件服务已更新'), 200);
  },
});

const deleteRouteDef = defineContractRoute(fileStorageConfigContract.remove, {
  middleware: [authMiddleware, guard({ permission: 'system:file:config:delete', audit: { description: '删除文件存储配置', module: '文件存储配置' } })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getFileStorageConfigBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteFileStorageConfig(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

fileStorageConfigsRouter.openapiRoutes([listRoute, defaultRoute, testRoute, testExistingRoute, getOneRoute, createRouteDef, updateRouteDef, setDefaultRoute, deleteRouteDef] as const);

export default fileStorageConfigsRouter;
