/**
 * 岗位相关 DTO
 */
import { z } from '@hono/zod-openapi';
import { auditFields } from './_audit';
import { UserPreviewDTO } from './_user-preview';

export const PositionUserPreviewDTO = UserPreviewDTO;

export const PositionDTO = z
  .object({
    id: z.number().int(),
    name: z.string().openapi({ example: '前端工程师' }),
    code: z.string().openapi({ example: 'frontend_dev' }),
    sort: z.number().int().openapi({ example: 1 }),
    status: z.enum(['enabled', 'disabled']),
    remark: z.string().nullable().optional(),
    userCount: z.number().int().optional().openapi({ example: 5 }),
    userPreview: z.array(PositionUserPreviewDTO).optional(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Position');
