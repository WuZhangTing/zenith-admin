import type { CmsPublishingTask, CmsPublishArtifact, CmsPublishTargetType } from '@zenith/shared/cms';
import { SEED_CMS_PUBLISH_ARTIFACTS, SEED_CMS_PUBLISH_TASKS } from '@zenith/shared/seed';

export const mockCmsPublishingTasks: CmsPublishingTask[] = SEED_CMS_PUBLISH_TASKS.map((item) => ({
  ...item,
  module: 'CMS内容管理',
  errorMessage: null,
  cancelRequested: false,
  nextRunAt: null,
  createdBy: 1,
  createdByName: '管理员',
  tenantId: null,
  siteId: Number(item.payload.siteId),
  siteName: 'Zenith 官方网站',
  siteIds: [Number(item.payload.siteId)],
  siteNames: ['Zenith 官方网站'],
  targetType: item.payload.targetType as CmsPublishTargetType,
  artifactCount: SEED_CMS_PUBLISH_ARTIFACTS.filter((artifact) => artifact.taskId === item.id).length,
  failedArtifactCount: 0,
}));
export const mockCmsPublishArtifacts: CmsPublishArtifact[] = SEED_CMS_PUBLISH_ARTIFACTS.map((item) => ({
  ...item,
  contentId: null,
  channelId: null,
  pageId: null,
  themeCode: 'default',
  error: null,
}));

let nextArtifactId = Math.max(...mockCmsPublishArtifacts.map((item) => item.id), 0) + 1;

export const getNextCmsPublishArtifactId = () => nextArtifactId++;