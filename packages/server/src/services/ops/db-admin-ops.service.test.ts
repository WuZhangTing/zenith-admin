import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('../../db', () => ({ db: { execute }, pgClient: {} }));
vi.mock('../../lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } }));

import { getIndexHealth, indexShape } from './db-admin-ops.service';

/** 模拟 getIndexHealth 查询返回的一行（分区已在 SQL 侧归并，这里直接给归并后的结果） */
function row(over: {
  table: string; index: string; definition: string;
  scans?: number; unique?: boolean; primary?: boolean; columns?: string[]; partitions?: number; relOid?: number;
}) {
  return {
    schema: 'public',
    table: over.table,
    index: over.index,
    scans: String(over.scans ?? 0),
    size_bytes: '8192',
    size_text: '8192 bytes',
    partitions: over.partitions ?? 1,
    is_unique: over.unique ?? false,
    is_primary: over.primary ?? false,
    rel_oid: String(over.relOid ?? 1000),
    definition: over.definition,
    columns: over.columns ?? [],
  };
}

describe('indexShape', () => {
  it('取 USING 起的定义正文，去掉 UNIQUE、索引名与表名', () => {
    expect(indexShape('CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)')).toBe('USING btree (email)');
    expect(indexShape('CREATE INDEX idx_users_email ON public.users USING btree (email)')).toBe('USING btree (email)');
  });

  it('表达式、opclass、排序方向与 WHERE 谓词都保留在正文里', () => {
    const def = 'CREATE INDEX t_i ON ONLY public.t USING btree (name, COALESCE(k, \'\'::text) DESC) WHERE (state = \'a\'::text)';
    expect(indexShape(def)).toBe('USING btree (name, COALESCE(k, \'\'::text) DESC) WHERE (state = \'a\'::text)');
  });

  it('没有 USING 段时原样返回', () => {
    expect(indexShape('weird')).toBe('weird');
  });
});

describe('getIndexHealth 判重', () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it('同表同形（仅 UNIQUE 不同）判为重复，不同表同形不判', async () => {
    execute.mockResolvedValue([
      row({ table: 'users', index: 'users_email_key', unique: true, columns: ['email'], definition: 'CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)' }),
      row({ table: 'users', index: 'idx_users_email', columns: ['email'], definition: 'CREATE INDEX idx_users_email ON public.users USING btree (email)' }),
      row({ table: 'members', index: 'members_email_idx', columns: ['email'], relOid: 2000, definition: 'CREATE INDEX members_email_idx ON public.members USING btree (email)' }),
    ]);
    const health = await getIndexHealth();
    expect(health.duplicate).toHaveLength(1);
    expect(health.duplicate[0]).toMatchObject({ table: 'users', columns: ['email'], shape: 'USING btree (email)' });
    expect(health.duplicate[0].indexes.map((x) => x.index)).toEqual(['users_email_key', 'idx_users_email']);
  });

  it('表达式不同的表达式索引不判重（indkey 里它们都是 0）', async () => {
    execute.mockResolvedValue([
      row({ table: 'async_tasks', index: 'async_tasks_payload_trgm_idx', definition: 'CREATE INDEX async_tasks_payload_trgm_idx ON public.async_tasks USING gin (((payload)::text) gin_trgm_ops)' }),
      row({ table: 'async_tasks', index: 'async_tasks_result_trgm_idx', definition: 'CREATE INDEX async_tasks_result_trgm_idx ON public.async_tasks USING gin (((result)::text) gin_trgm_ops)' }),
    ]);
    expect((await getIndexHealth()).duplicate).toEqual([]);
  });

  it('同列不同 WHERE 谓词的部分索引、不同访问方法 / 排序方向不判重', async () => {
    execute.mockResolvedValue([
      row({ table: 'job', index: 'job_i1', unique: true, columns: ['name'], definition: 'CREATE UNIQUE INDEX job_i1 ON pgboss.job USING btree (name) WHERE (state = \'created\'::text)' }),
      row({ table: 'job', index: 'job_i2', unique: true, columns: ['name'], definition: 'CREATE UNIQUE INDEX job_i2 ON pgboss.job USING btree (name) WHERE (state = \'active\'::text)' }),
      row({ table: 'job', index: 'job_name_idx', columns: ['name'], definition: 'CREATE INDEX job_name_idx ON pgboss.job USING btree (name)' }),
      row({ table: 'job', index: 'job_name_trgm', columns: ['name'], definition: 'CREATE INDEX job_name_trgm ON pgboss.job USING gin (name gin_trgm_ops)' }),
      row({ table: 'job', index: 'job_name_desc', columns: ['name'], definition: 'CREATE INDEX job_name_desc ON pgboss.job USING btree (name DESC)' }),
    ]);
    expect((await getIndexHealth()).duplicate).toEqual([]);
  });

  it('未使用 = 扫描数为 0 且非主键；归并后的分区数与汇总统计透传', async () => {
    execute.mockResolvedValue([
      row({ table: 'iot_telemetry', index: 'iot_telemetry_pkey', primary: true, unique: true, definition: 'CREATE UNIQUE INDEX iot_telemetry_pkey ON ONLY public.iot_telemetry USING btree (id)' }),
      row({ table: 'iot_telemetry', index: 'idx_iot_telemetry_time_brin', partitions: 9, columns: ['reported_at'], definition: 'CREATE INDEX idx_iot_telemetry_time_brin ON ONLY public.iot_telemetry USING brin (reported_at)' }),
      row({ table: 'users', index: 'users_pkey', primary: true, unique: true, scans: 42, definition: 'CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)' }),
    ]);
    const health = await getIndexHealth();
    expect(health.totalIndexes).toBe(3);
    expect(health.unused.map((x) => x.index)).toEqual(['idx_iot_telemetry_time_brin']);
    expect(health.unused[0].partitions).toBe(9);
  });
});
