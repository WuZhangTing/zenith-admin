import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db', () => ({ db: {}, pgClient: {} }));
vi.mock('../../lib/context', () => ({ currentUserId: vi.fn(() => 1) }));
vi.mock('../../lib/db-readonly-role', () => ({ applyReadonlyTransactionGuards: vi.fn() }));

const { assertConsoleReadOnlySql, sanitizeWhereFragment } = await import('./db-admin.service');

describe('assertConsoleReadOnlySql', () => {
  it('allows query statements, including multiple read-only statements and leading comments', () => {
    expect(() => assertConsoleReadOnlySql('SELECT 1')).not.toThrow();
    expect(() => assertConsoleReadOnlySql('-- 注释\n/* 块 */ WITH x AS (SELECT 1) SELECT * FROM x')).not.toThrow();
    expect(() => assertConsoleReadOnlySql('SELECT 1; EXPLAIN SELECT 2; SHOW search_path; TABLE users; VALUES (1)')).not.toThrow();
    expect(() => assertConsoleReadOnlySql("SELECT 'delete from users; drop table x' AS s")).not.toThrow();
    expect(() => assertConsoleReadOnlySql('SELECT $$ update t set a = 1; $$ AS s')).not.toThrow();
  });

  it('rejects non-query statements anywhere in the batch', () => {
    expect(() => assertConsoleReadOnlySql('DELETE FROM users')).toThrow('只读');
    expect(() => assertConsoleReadOnlySql('SELECT 1; UPDATE users SET nickname = \'x\'')).toThrow('只读');
    expect(() => assertConsoleReadOnlySql('SELECT 1; SET ROLE postgres; SELECT 2')).toThrow('只读');
    expect(() => assertConsoleReadOnlySql('SELECT 1; RESET ROLE')).toThrow('只读');
    expect(() => assertConsoleReadOnlySql("COPY (SELECT 1) TO PROGRAM 'id'")).toThrow('只读');
    expect(() => assertConsoleReadOnlySql("/* x */ COPY users TO '/tmp/u.csv'")).toThrow('只读');
  });

  it('rejects server-side file/program functions and role tampering even inside SELECT', () => {
    expect(() => assertConsoleReadOnlySql("SELECT pg_read_file('/etc/passwd')")).toThrow('pg_read_file');
    expect(() => assertConsoleReadOnlySql("SELECT pg_ls_dir('.')")).toThrow('pg_ls_dir');
    expect(() => assertConsoleReadOnlySql("SELECT lo_import('/etc/passwd')")).toThrow('lo_import');
    expect(() => assertConsoleReadOnlySql("SELECT set_config('role', 'postgres', true); SELECT 1")).toThrow('set_config');
    expect(() => assertConsoleReadOnlySql('SELECT "pg_read_file"(\'/etc/passwd\')')).toThrow('引号函数');
    expect(() => assertConsoleReadOnlySql("EXPLAIN ANALYZE SELECT pg_terminate_backend(1)")).toThrow('pg_terminate_backend');
    expect(() => assertConsoleReadOnlySql("WITH d AS (SELECT * FROM dblink_exec('c', 'x')) SELECT 1")).toThrow('dblink_exec');
  });
});

describe('sanitizeWhereFragment', () => {
  it('passes plain boolean expressions', () => {
    expect(sanitizeWhereFragment("status = 'active' AND created_at > now() - interval '1 day'"))
      .toBe("status = 'active' AND created_at > now() - interval '1 day'");
    expect(sanitizeWhereFragment('   ')).toBeUndefined();
  });

  it('rejects statement chaining, comments and dangerous functions', () => {
    expect(() => sanitizeWhereFragment('1=1; DROP TABLE users')).toThrow('分号');
    expect(() => sanitizeWhereFragment('1=1 -- x')).toThrow('注释');
    expect(() => sanitizeWhereFragment("pg_read_file('/etc/passwd') IS NOT NULL")).toThrow('pg_read_file');
    expect(() => sanitizeWhereFragment("set_config('role','postgres',true) IS NOT NULL")).toThrow('set_config');
  });
});
