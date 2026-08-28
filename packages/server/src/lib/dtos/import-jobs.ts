/**
 * 数据导入中心 DTO
 */
import { z } from '@hono/zod-openapi';

export const ImportColumnMetaDTO = z
  .object({
    key: z.string(),
    header: z.string(),
    required: z.boolean().optional(),
    example: z.string().optional(),
    enumValues: z.array(z.string()).optional(),
    note: z.string().optional(),
  })
  .openapi('ImportColumnMeta');

export const ImportEntityMetaDTO = z
  .object({
    entity: z.string().openapi({ example: 'member.members' }),
    title: z.string(),
    module: z.string(),
    description: z.string().nullable(),
    maxRows: z.number().int(),
    columns: z.array(ImportColumnMetaDTO),
  })
  .openapi('ImportEntityMeta');
