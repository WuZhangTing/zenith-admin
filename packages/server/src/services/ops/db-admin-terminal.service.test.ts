import { describe, expect, it } from 'vitest';
import {
  buildPsqlLaunch,
  parseDatabaseUrl,
  parseDbTerminalShellType,
} from './db-admin-terminal.service';

describe('parseDbTerminalShellType', () => {
  it('识别只读与读写标识', () => {
    expect(parseDbTerminalShellType('db-psql')).toBe('ro');
    expect(parseDbTerminalShellType('db-psql:rw')).toBe('rw');
  });

  it('其余 shell 类型返回 null', () => {
    expect(parseDbTerminalShellType(undefined)).toBeNull();
    expect(parseDbTerminalShellType('bash')).toBeNull();
    expect(parseDbTerminalShellType('db-psql:ro:extra')).toBeNull();
    expect(parseDbTerminalShellType('docker-exec:abc:sh')).toBeNull();
  });
});

describe('parseDatabaseUrl', () => {
  it('解析标准连接串', () => {
    expect(parseDatabaseUrl('postgresql://app:secret@db.internal:5433/zenith')).toEqual({
      host: 'db.internal',
      port: '5433',
      user: 'app',
      password: 'secret',
      database: 'zenith',
      sslMode: null,
    });
  });

  it('缺省端口回退 5432 并解码转义字符', () => {
    const parsed = parseDatabaseUrl('postgres://app:p%40ss%20w0rd@localhost/zenith_admin');
    expect(parsed.port).toBe('5432');
    expect(parsed.password).toBe('p@ss w0rd');
  });

  it('透传 sslmode 查询参数', () => {
    expect(parseDatabaseUrl('postgres://u:p@h/db?sslmode=verify-full').sslMode).toBe('verify-full');
  });

  it('缺少数据库名时抛错', () => {
    expect(() => parseDatabaseUrl('postgres://u:p@h:5432/')).toThrow('DATABASE_URL 缺少数据库名');
  });
});

describe('buildPsqlLaunch', () => {
  const params = {
    host: 'localhost', port: '5432', user: 'postgres', password: 'pw',
    database: 'zenith_admin', sslMode: null,
  };

  it('凭据只进环境变量，不进程序参数', () => {
    const launch = buildPsqlLaunch('rw', 'psql', params);
    expect(launch.args).toEqual(['-h', 'localhost', '-p', '5432', '-U', 'postgres', '-d', 'zenith_admin']);
    expect(launch.args.join(' ')).not.toContain('pw');
    expect(launch.env.PGPASSWORD).toBe('pw');
    expect(launch.env.PGCLIENTENCODING).toBe('UTF8');
  });

  it('只读模式注入 default_transaction_read_only', () => {
    expect(buildPsqlLaunch('ro', 'psql', params).env.PGOPTIONS).toBe('-c default_transaction_read_only=on');
    expect(buildPsqlLaunch('rw', 'psql', params).env.PGOPTIONS).toBeUndefined();
  });

  it('标签区分只读与读写', () => {
    expect(buildPsqlLaunch('ro', 'psql', params).label).toBe('psql:zenith_admin · 只读');
    expect(buildPsqlLaunch('rw', 'psql', params).label).toBe('psql:zenith_admin · 读写');
  });

  it('连接串 sslmode 优先生效', () => {
    expect(buildPsqlLaunch('ro', 'psql', { ...params, sslMode: 'require' }).env.PGSSLMODE).toBe('require');
  });
});
