/**
 * 应用版本管理 DTO（应用 / 版本 / 制品 / 公开检查 / 看板统计）。
 */
import { z } from '@hono/zod-openapi';
import {
  APP_ARCHES,
  APP_ARTIFACT_KINDS,
  APP_PLATFORMS,
  APP_RELEASE_CHANNELS,
  APP_RELEASE_STATUSES,
} from '@zenith/shared/ops';
import { auditFields } from './_audit';

export const ClientAppDTO = z
  .object({
    id: z.number().int(),
    appKey: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: z.enum(['enabled', 'disabled']),
    releaseCount: z.number().int().optional(),
    latestVersion: z.string().nullable().optional(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ClientApp');

export const AppArtifactDTO = z
  .object({
    id: z.number().int(),
    releaseId: z.number().int(),
    platform: z.enum(APP_PLATFORMS),
    arch: z.enum(APP_ARCHES),
    kind: z.enum(APP_ARTIFACT_KINDS),
    fileId: z.string().nullable().optional(),
    externalUrl: z.string().nullable().optional(),
    fileName: z.string(),
    size: z.number(),
    sha256: z.string().nullable().optional(),
    downloadCount: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('AppArtifact');

export const AppReleaseDTO = z
  .object({
    id: z.number().int(),
    appId: z.number().int(),
    appKey: z.string().optional(),
    appName: z.string().optional(),
    channel: z.enum(APP_RELEASE_CHANNELS),
    version: z.string(),
    notes: z.string().nullable().optional(),
    status: z.enum(APP_RELEASE_STATUSES),
    mandatory: z.boolean(),
    minVersion: z.string().nullable().optional(),
    rolloutPercent: z.number().int(),
    publishedAt: z.string().nullable().optional(),
    artifactCount: z.number().int().optional(),
    artifacts: z.array(AppArtifactDTO).optional(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('AppRelease');

export const AppUpdateCheckResultDTO = z
  .object({
    hasUpdate: z.boolean(),
    mandatory: z.boolean().optional(),
    version: z.string().optional(),
    notes: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    artifact: z
      .object({
        kind: z.enum(APP_ARTIFACT_KINDS),
        fileName: z.string(),
        size: z.number(),
        sha256: z.string().nullable().optional(),
        downloadUrl: z.string(),
      })
      .optional(),
  })
  .openapi('AppUpdateCheckResult');

export const AppPublicReleaseInfoDTO = z
  .object({
    version: z.string(),
    notes: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    artifacts: z.array(
      z.object({
        platform: z.enum(APP_PLATFORMS),
        arch: z.enum(APP_ARCHES),
        kind: z.enum(APP_ARTIFACT_KINDS),
        fileName: z.string(),
        size: z.number(),
        sha256: z.string().nullable().optional(),
        downloadUrl: z.string(),
      }),
    ),
  })
  .openapi('AppPublicReleaseInfo');

export const AppReleaseStatsDTO = z
  .object({
    totals: z.object({
      checks: z.number().int(),
      downloads: z.number().int(),
      devices: z.number().int(),
      installSuccess: z.number().int(),
      installFail: z.number().int(),
    }),
    trend: z.array(
      z.object({
        date: z.string(),
        checks: z.number().int(),
        downloads: z.number().int(),
        installSuccess: z.number().int(),
        installFail: z.number().int(),
      }),
    ),
    platforms: z.array(z.object({ platform: z.enum(APP_PLATFORMS), count: z.number().int() })),
    versions: z.array(z.object({ version: z.string(), devices: z.number().int() })),
  })
  .openapi('AppReleaseStats');

export const ClientDeviceDTO = z
  .object({
    id: z.number().int(),
    deviceId: z.string(),
    appId: z.number().int(),
    appName: z.string().optional(),
    platform: z.enum(APP_PLATFORMS),
    arch: z.enum(APP_ARCHES).nullable().optional(),
    deviceModel: z.string().nullable().optional(),
    osVersion: z.string().nullable().optional(),
    appVersion: z.string().nullable().optional(),
    subjectType: z.enum(['user', 'member']).nullable().optional(),
    subjectId: z.number().int().nullable().optional(),
    subjectName: z.string().nullable().optional(),
    pushProvider: z.string().nullable().optional(),
    pushRegistrationId: z.string().nullable().optional(),
    pushEnabled: z.boolean(),
    createdAt: z.string(),
    lastActiveAt: z.string(),
  })
  .openapi('ClientDevice');
