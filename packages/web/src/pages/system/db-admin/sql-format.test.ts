import { describe, expect, it } from 'vitest';
import { isReadOnlySql, stripLeadingSqlComments } from './sql-format';

describe('stripLeadingSqlComments', () => {
  it('去掉行注释与块注释后暴露首个关键字', () => {
    expect(stripLeadingSqlComments('-- 注释\nSELECT 1')).toBe('SELECT 1');
    expect(stripLeadingSqlComments('/* 块 */ SELECT 1')).toBe('SELECT 1');
    expect(stripLeadingSqlComments('-- 只有注释')).toBe('');
  });
});

describe('isReadOnlySql', () => {
  it('允许查询类语句', () => {
    expect(isReadOnlySql('SELECT * FROM users')).toBe(true);
    expect(isReadOnlySql('-- 只读模式\nSELECT 1;')).toBe(true);
    expect(isReadOnlySql('WITH t AS (SELECT 1) SELECT * FROM t')).toBe(true);
    expect(isReadOnlySql('EXPLAIN SELECT 1')).toBe(true);
    expect(isReadOnlySql('SHOW server_version')).toBe(true);
  });

  it('拒绝 DML / DDL', () => {
    expect(isReadOnlySql('UPDATE users SET a=1')).toBe(false);
    expect(isReadOnlySql('DELETE FROM users')).toBe(false);
    expect(isReadOnlySql('INSERT INTO t VALUES (1)')).toBe(false);
    expect(isReadOnlySql('DROP TABLE users')).toBe(false);
    expect(isReadOnlySql('SELECT 1; DELETE FROM users;')).toBe(false);
  });

  it('字符串字面量中的分号与关键字不影响判定', () => {
    expect(isReadOnlySql("SELECT ';DELETE FROM users;' AS s")).toBe(true);
    expect(isReadOnlySql("SELECT 'it''s; DROP TABLE x' AS s")).toBe(true);
  });

  it('空内容或纯注释返回 false', () => {
    expect(isReadOnlySql('')).toBe(false);
    expect(isReadOnlySql('-- 注释而已')).toBe(false);
  });
});
