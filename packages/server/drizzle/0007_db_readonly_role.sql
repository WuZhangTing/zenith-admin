-- 0007: 用户手写 SQL（数据库管理控制台 / 导出 / 报表数据集）的最小权限执行角色。
-- 应用连接通常是库 owner 甚至 superuser；READ ONLY 事务挡不住 COPY TO PROGRAM、pg_read_file、
-- lo_export 等服务器端函数。这里创建 NOLOGIN 只读角色并授予 SELECT，应用在事务内 SET LOCAL ROLE 切换。
-- 无 CREATEROLE 权限的部署会跳过创建（不阻断迁移），服务端探测不到角色时降级为白名单 + READ ONLY 并打 warn。
DO $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zenith_readonly') THEN
    BEGIN
      EXECUTE 'CREATE ROLE zenith_readonly NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'zenith_readonly 角色未创建：当前用户缺少 CREATEROLE，数据库控制台将退化为仅白名单+只读事务防护';
      RETURN;
    END;
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO zenith_readonly', current_database());

  -- 所有业务 schema：SELECT 现有表 / 序列，并让未来新建对象自动继承
  FOR r IN
    SELECT nspname FROM pg_namespace
    WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND nspname NOT LIKE 'pg_temp_%' AND nspname NOT LIKE 'pg_toast_temp_%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO zenith_readonly', r.nspname);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO zenith_readonly', r.nspname);
    EXECUTE format('GRANT SELECT ON ALL SEQUENCES IN SCHEMA %I TO zenith_readonly', r.nspname);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO zenith_readonly', r.nspname);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON SEQUENCES TO zenith_readonly', r.nspname);
  END LOOP;

  -- 应用用户后续新建的任意 schema 中的表 / 序列也默认可读（schema 的 USAGE 由服务端启动时补齐）
  EXECUTE 'ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO zenith_readonly';
  EXECUTE 'ALTER DEFAULT PRIVILEGES GRANT SELECT ON SEQUENCES TO zenith_readonly';

  -- 应用用户可 SET ROLE 到只读角色（角色 NOINHERIT，应用自身权限不受影响）
  EXECUTE format('GRANT zenith_readonly TO %I', current_user);

  -- 明确收回服务器端文件 / 程序能力（默认即无，防止被外部误授）；PG < 11 无这些预定义角色则忽略
  BEGIN
    EXECUTE 'REVOKE pg_read_server_files, pg_write_server_files, pg_execute_server_program FROM zenith_readonly';
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;