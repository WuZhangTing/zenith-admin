ALTER TABLE "departments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "departments_id_seq";--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "departments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "menus" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "menus" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "menus_id_seq";--> statement-breakpoint
ALTER TABLE "menus" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "menus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "positions_id_seq";--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "roles_id_seq";--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "tenant_packages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tenant_packages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "tenant_packages_id_seq";--> statement-breakpoint
ALTER TABLE "tenant_packages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "tenant_packages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "tenants_id_seq";--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "tenants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_groups" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_groups" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_groups_id_seq";--> statement-breakpoint
ALTER TABLE "user_groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "users_id_seq";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "license_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "license_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "license_events_id_seq";--> statement-breakpoint
ALTER TABLE "license_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "license_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "licenses" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "licenses" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "licenses_id_seq";--> statement-breakpoint
ALTER TABLE "licenses" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "licenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "system_installations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "system_installations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "system_installations_id_seq";--> statement-breakpoint
ALTER TABLE "system_installations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "system_installations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "business_files" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "business_files" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "business_files_id_seq";--> statement-breakpoint
ALTER TABLE "business_files" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "business_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "file_storage_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "file_storage_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "file_storage_configs_id_seq";--> statement-breakpoint
ALTER TABLE "file_storage_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "file_storage_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "upload_chunks" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "upload_chunks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "upload_chunks_id_seq";--> statement-breakpoint
ALTER TABLE "upload_chunks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "upload_chunks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "upload_sessions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "upload_sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "upload_sessions_id_seq";--> statement-breakpoint
ALTER TABLE "upload_sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "upload_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "data_mask_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "data_mask_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "data_mask_configs_id_seq";--> statement-breakpoint
ALTER TABLE "data_mask_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "data_mask_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "async_task_items" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "async_task_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "async_task_items_id_seq";--> statement-breakpoint
ALTER TABLE "async_task_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "async_task_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "async_tasks" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "async_tasks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "async_tasks_id_seq";--> statement-breakpoint
ALTER TABLE "async_tasks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "async_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "export_job_downloads" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "export_job_downloads" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "export_job_downloads_id_seq";--> statement-breakpoint
ALTER TABLE "export_job_downloads" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "export_job_downloads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "export_jobs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "export_jobs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "export_jobs_id_seq";--> statement-breakpoint
ALTER TABLE "export_jobs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "export_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cron_job_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cron_job_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cron_job_logs_id_seq";--> statement-breakpoint
ALTER TABLE "cron_job_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cron_job_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cron_jobs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cron_jobs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cron_jobs_id_seq";--> statement-breakpoint
ALTER TABLE "cron_jobs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cron_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "maintenance_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "maintenance_logs_id_seq";--> statement-breakpoint
ALTER TABLE "maintenance_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "maintenance_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "maintenance_mode" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "maintenance_mode" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "maintenance_mode_id_seq";--> statement-breakpoint
ALTER TABLE "maintenance_mode" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "maintenance_mode_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "regions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "regions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "regions_id_seq";--> statement-breakpoint
ALTER TABLE "regions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "system_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "system_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "system_configs_id_seq";--> statement-breakpoint
ALTER TABLE "system_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "system_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "system_scheduler_runs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "system_scheduler_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "system_scheduler_runs_id_seq";--> statement-breakpoint
ALTER TABLE "system_scheduler_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "system_scheduler_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_feedbacks" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_feedbacks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_feedbacks_id_seq";--> statement-breakpoint
ALTER TABLE "user_feedbacks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_feedbacks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "login_risk_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "login_risk_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "login_risk_events_id_seq";--> statement-breakpoint
ALTER TABLE "login_risk_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "login_risk_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "oauth_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "oauth_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "oauth_configs_id_seq";--> statement-breakpoint
ALTER TABLE "oauth_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "oauth_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "password_reset_tokens_id_seq";--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "password_reset_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rate_limit_rules_id_seq";--> statement-breakpoint
ALTER TABLE "rate_limit_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rate_limit_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_api_tokens" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_api_tokens" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_api_tokens_id_seq";--> statement-breakpoint
ALTER TABLE "user_api_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_api_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_mfa_factors" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_mfa_factors" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_mfa_factors_id_seq";--> statement-breakpoint
ALTER TABLE "user_mfa_factors" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_mfa_factors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_oauth_accounts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_oauth_accounts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_oauth_accounts_id_seq";--> statement-breakpoint
ALTER TABLE "user_oauth_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_oauth_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_trusted_devices" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_trusted_devices" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_trusted_devices_id_seq";--> statement-breakpoint
ALTER TABLE "user_trusted_devices" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_trusted_devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "identity_provider_sync_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "identity_provider_sync_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "identity_provider_sync_logs_id_seq";--> statement-breakpoint
ALTER TABLE "identity_provider_sync_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "identity_provider_sync_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "tenant_identity_providers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tenant_identity_providers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "tenant_identity_providers_id_seq";--> statement-breakpoint
ALTER TABLE "tenant_identity_providers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "tenant_identity_providers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_identity_accounts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_identity_accounts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_identity_accounts_id_seq";--> statement-breakpoint
ALTER TABLE "user_identity_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_identity_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "directory_sync_conflicts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "directory_sync_conflicts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "directory_sync_conflicts_id_seq";--> statement-breakpoint
ALTER TABLE "directory_sync_conflicts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "directory_sync_conflicts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "directory_sync_dept_links" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "directory_sync_dept_links" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "directory_sync_dept_links_id_seq";--> statement-breakpoint
ALTER TABLE "directory_sync_dept_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "directory_sync_dept_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "directory_sync_run_items" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "directory_sync_run_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "directory_sync_run_items_id_seq";--> statement-breakpoint
ALTER TABLE "directory_sync_run_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "directory_sync_run_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "directory_sync_runs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "directory_sync_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "directory_sync_runs_id_seq";--> statement-breakpoint
ALTER TABLE "directory_sync_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "directory_sync_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "directory_sync_sources_id_seq";--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "directory_sync_sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "directory_sync_user_links" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "directory_sync_user_links" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "directory_sync_user_links_id_seq";--> statement-breakpoint
ALTER TABLE "directory_sync_user_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "directory_sync_user_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "dict_items" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "dict_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "dict_items_id_seq";--> statement-breakpoint
ALTER TABLE "dict_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "dict_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "dicts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "dicts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "dicts_id_seq";--> statement-breakpoint
ALTER TABLE "dicts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "dicts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ip_access_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ip_access_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ip_access_logs_id_seq";--> statement-breakpoint
ALTER TABLE "ip_access_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ip_access_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "login_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "login_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "login_logs_id_seq";--> statement-breakpoint
ALTER TABLE "login_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "login_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "operation_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "operation_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "operation_logs_id_seq";--> statement-breakpoint
ALTER TABLE "operation_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "operation_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_daily_rollup" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_daily_rollup" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_daily_rollup_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_daily_rollup" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_daily_rollup_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_event_meta" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_event_meta" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_event_meta_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_event_meta" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_event_meta_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_event_overrides" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_event_overrides" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_event_overrides_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_event_overrides" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_event_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_event_quality_daily" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_event_quality_daily" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_event_quality_daily_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_event_quality_daily" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_event_quality_daily_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_experiments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_experiments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_experiments_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_experiments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_experiments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_identity_map" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_identity_map" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_identity_map_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_identity_map" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_identity_map_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_saved_reports" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_saved_reports" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_saved_reports_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_saved_reports" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_saved_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_segment_campaigns" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_segment_campaigns" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_segment_campaigns_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_segment_campaigns" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_segment_campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_segment_members" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_segment_members" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_segment_members_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_segment_members" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_segment_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_sessions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_sessions_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_settings" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_settings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_settings_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_settings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_sites" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_sites" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_sites_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_sites" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_sites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_user_profiles" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_user_profiles" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_user_profiles_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_user_profiles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_user_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "analytics_user_segments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "analytics_user_segments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "analytics_user_segments_id_seq";--> statement-breakpoint
ALTER TABLE "analytics_user_segments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "analytics_user_segments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "error_alert_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "error_alert_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "error_alert_logs_id_seq";--> statement-breakpoint
ALTER TABLE "error_alert_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "error_alert_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "error_alert_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "error_alert_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "error_alert_rules_id_seq";--> statement-breakpoint
ALTER TABLE "error_alert_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "error_alert_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "error_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "error_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "error_events_id_seq";--> statement-breakpoint
ALTER TABLE "error_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "error_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "error_groups" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "error_groups" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "error_groups_id_seq";--> statement-breakpoint
ALTER TABLE "error_groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "error_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "replay_access_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "replay_access_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "replay_access_logs_id_seq";--> statement-breakpoint
ALTER TABLE "replay_access_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "replay_access_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "replay_click_points" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "replay_click_points" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "replay_click_points_id_seq";--> statement-breakpoint
ALTER TABLE "replay_click_points" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "replay_click_points_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "replay_segments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "replay_segments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "replay_segments_id_seq";--> statement-breakpoint
ALTER TABLE "replay_segments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "replay_segments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "source_maps" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "source_maps" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "source_maps_id_seq";--> statement-breakpoint
ALTER TABLE "source_maps" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "source_maps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_events_id_seq";--> statement-breakpoint
ALTER TABLE "user_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "announcement_reads" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "announcement_reads" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "announcement_reads_id_seq";--> statement-breakpoint
ALTER TABLE "announcement_reads" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "announcement_reads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "announcement_recipients" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "announcement_recipients" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "announcement_recipients_id_seq";--> statement-breakpoint
ALTER TABLE "announcement_recipients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "announcement_recipients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "announcements_id_seq";--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "announcements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_automation_runs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_automation_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_automation_runs_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_automation_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_automation_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_automations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_automations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_automations_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_automations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_automations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_categories" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_categories" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_categories_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_comments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_comments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_comments_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_compensation_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_compensation_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_compensation_logs_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_compensation_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_compensation_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_compensations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_compensations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_compensations_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_compensations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_compensations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_connector_invocations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_connector_invocations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_connector_invocations_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_connector_invocations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_connector_invocations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_connectors" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_connectors" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_connectors_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_connectors" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_connectors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_data_sources" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_data_sources" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_data_sources_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_data_sources" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_data_sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_definition_versions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_definition_versions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_definition_versions_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_definition_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_definition_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_definitions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_definitions_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_definitions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_delegations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_delegations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_delegations_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_delegations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_delegations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_engine_health_snapshots" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_engine_health_snapshots" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_engine_health_snapshots_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_engine_health_snapshots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_engine_health_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_event_subscriptions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_event_subscriptions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_event_subscriptions_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_event_subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_event_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_forms" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_forms" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_forms_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_forms" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_forms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_instance_migrations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_instance_migrations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_instance_migrations_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_instance_migrations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_instance_migrations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_instances" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_instances" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_instances_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_instances" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_instances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_job_executions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_job_executions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_job_executions_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_job_executions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_job_executions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_jobs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_jobs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_jobs_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_jobs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_quick_phrases" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_quick_phrases" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_quick_phrases_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_quick_phrases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_quick_phrases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_saved_views" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_saved_views" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_saved_views_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_saved_views" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_saved_views_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_schedules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_schedules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_schedules_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_schedules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_schedules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_serial_counters" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_serial_counters" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_serial_counters_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_serial_counters" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_serial_counters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_simulation_cases" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_simulation_cases" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_simulation_cases_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_simulation_cases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_simulation_cases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_task_consults" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_task_consults" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_task_consults_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_task_consults" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_task_consults_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_task_transfers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_task_transfers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_task_transfers_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_task_transfers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_task_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_task_urges" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_task_urges" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_task_urges_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_task_urges" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_task_urges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_tasks" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_tasks_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_tasks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_templates_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "workflow_tokens" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "workflow_tokens" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "workflow_tokens_id_seq";--> statement-breakpoint
ALTER TABLE "workflow_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "workflow_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "broadcast_campaigns" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "broadcast_campaigns" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "broadcast_campaigns_id_seq";--> statement-breakpoint
ALTER TABLE "broadcast_campaigns" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "broadcast_campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "email_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "email_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "email_configs_id_seq";--> statement-breakpoint
ALTER TABLE "email_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "email_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "email_send_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "email_send_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "email_send_logs_id_seq";--> statement-breakpoint
ALTER TABLE "email_send_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "email_send_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "email_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "email_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "email_templates_id_seq";--> statement-breakpoint
ALTER TABLE "email_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "email_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "in_app_messages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "in_app_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "in_app_messages_id_seq";--> statement-breakpoint
ALTER TABLE "in_app_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "in_app_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "in_app_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "in_app_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "in_app_templates_id_seq";--> statement-breakpoint
ALTER TABLE "in_app_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "in_app_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "notification_dispatches" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "notification_dispatches" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "notification_dispatches_id_seq";--> statement-breakpoint
ALTER TABLE "notification_dispatches" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "notification_dispatches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "notification_event_overrides" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "notification_event_overrides" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "notification_event_overrides_id_seq";--> statement-breakpoint
ALTER TABLE "notification_event_overrides" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "notification_event_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "notification_outbox_id_seq";--> statement-breakpoint
ALTER TABLE "notification_outbox" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "notification_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "notification_preferences_id_seq";--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "notification_preferences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "notification_recipient_settings" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "notification_recipient_settings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "notification_recipient_settings_id_seq";--> statement-breakpoint
ALTER TABLE "notification_recipient_settings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "notification_recipient_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "push_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "push_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "push_configs_id_seq";--> statement-breakpoint
ALTER TABLE "push_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "push_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "push_send_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "push_send_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "push_send_logs_id_seq";--> statement-breakpoint
ALTER TABLE "push_send_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "push_send_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "sms_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "sms_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "sms_configs_id_seq";--> statement-breakpoint
ALTER TABLE "sms_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "sms_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "sms_send_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "sms_send_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "sms_send_logs_id_seq";--> statement-breakpoint
ALTER TABLE "sms_send_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "sms_send_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "sms_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "sms_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "sms_templates_id_seq";--> statement-breakpoint
ALTER TABLE "sms_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "sms_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "db_admin_query_history" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "db_admin_query_history" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "db_admin_query_history_id_seq";--> statement-breakpoint
ALTER TABLE "db_admin_query_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "db_admin_query_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "db_backups" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "db_backups" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "db_backups_id_seq";--> statement-breakpoint
ALTER TABLE "db_backups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "db_backups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "db_query_favorites" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "db_query_favorites" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "db_query_favorites_id_seq";--> statement-breakpoint
ALTER TABLE "db_query_favorites" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "db_query_favorites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "tags_id_seq";--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_asset_versions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_asset_versions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_asset_versions_id_seq";--> statement-breakpoint
ALTER TABLE "rule_asset_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_asset_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_decision_flows" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_decision_flows" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_decision_flows_id_seq";--> statement-breakpoint
ALTER TABLE "rule_decision_flows" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_decision_flows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_decision_table_versions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_decision_table_versions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_decision_table_versions_id_seq";--> statement-breakpoint
ALTER TABLE "rule_decision_table_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_decision_table_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_decision_tables" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_decision_tables" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_decision_tables_id_seq";--> statement-breakpoint
ALTER TABLE "rule_decision_tables" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_decision_tables_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_executions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_executions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_executions_id_seq";--> statement-breakpoint
ALTER TABLE "rule_executions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_executions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_list_items" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_list_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_list_items_id_seq";--> statement-breakpoint
ALTER TABLE "rule_list_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_list_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_lists" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_lists" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_lists_id_seq";--> statement-breakpoint
ALTER TABLE "rule_lists" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_lists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_scorecards" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_scorecards" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_scorecards_id_seq";--> statement-breakpoint
ALTER TABLE "rule_scorecards" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_scorecards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rule_test_cases" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rule_test_cases" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rule_test_cases_id_seq";--> statement-breakpoint
ALTER TABLE "rule_test_cases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rule_test_cases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "biz_leaves" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "biz_leaves" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "biz_leaves_id_seq";--> statement-breakpoint
ALTER TABLE "biz_leaves" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "biz_leaves_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "biz_pay_demos" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "biz_pay_demos" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "biz_pay_demos_id_seq";--> statement-breakpoint
ALTER TABLE "biz_pay_demos" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "biz_pay_demos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_conversations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_conversations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_conversations_id_seq";--> statement-breakpoint
ALTER TABLE "chat_conversations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_custom_emojis" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_custom_emojis" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_custom_emojis_id_seq";--> statement-breakpoint
ALTER TABLE "chat_custom_emojis" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_custom_emojis_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_group_invites" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_group_invites" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_group_invites_id_seq";--> statement-breakpoint
ALTER TABLE "chat_group_invites" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_group_invites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_group_join_requests" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_group_join_requests" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_group_join_requests_id_seq";--> statement-breakpoint
ALTER TABLE "chat_group_join_requests" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_group_join_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_message_favorites" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_message_favorites" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_message_favorites_id_seq";--> statement-breakpoint
ALTER TABLE "chat_message_favorites" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_message_favorites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_message_reactions_id_seq";--> statement-breakpoint
ALTER TABLE "chat_message_reactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_message_reactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_messages_id_seq";--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_quick_replies" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_quick_replies" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_quick_replies_id_seq";--> statement-breakpoint
ALTER TABLE "chat_quick_replies" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_quick_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_scheduled_messages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_scheduled_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_scheduled_messages_id_seq";--> statement-breakpoint
ALTER TABLE "chat_scheduled_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_scheduled_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "chat_webhooks" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "chat_webhooks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "chat_webhooks_id_seq";--> statement-breakpoint
ALTER TABLE "chat_webhooks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "chat_webhooks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "channel_auto_replies" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "channel_auto_replies" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "channel_auto_replies_id_seq";--> statement-breakpoint
ALTER TABLE "channel_auto_replies" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "channel_auto_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "channel_menus" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "channel_menus" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "channel_menus_id_seq";--> statement-breakpoint
ALTER TABLE "channel_menus" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "channel_menus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "channel_message_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "channel_message_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "channel_message_templates_id_seq";--> statement-breakpoint
ALTER TABLE "channel_message_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "channel_message_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "channel_messages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "channel_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "channel_messages_id_seq";--> statement-breakpoint
ALTER TABLE "channel_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "channel_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "channel_quick_replies" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "channel_quick_replies" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "channel_quick_replies_id_seq";--> statement-breakpoint
ALTER TABLE "channel_quick_replies" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "channel_quick_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "channels_id_seq";--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "channels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_accounts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_accounts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_accounts_id_seq";--> statement-breakpoint
ALTER TABLE "payment_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_apps" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_apps" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_apps_id_seq";--> statement-breakpoint
ALTER TABLE "payment_apps" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_apps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_channel_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_channel_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_channel_configs_id_seq";--> statement-breakpoint
ALTER TABLE "payment_channel_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_channel_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_contracts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_contracts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_contracts_id_seq";--> statement-breakpoint
ALTER TABLE "payment_contracts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_contracts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_deduct_plans" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_deduct_plans" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_deduct_plans_id_seq";--> statement-breakpoint
ALTER TABLE "payment_deduct_plans" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_deduct_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_dispute_replies" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_dispute_replies" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_dispute_replies_id_seq";--> statement-breakpoint
ALTER TABLE "payment_dispute_replies" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_dispute_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_disputes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_disputes" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_disputes_id_seq";--> statement-breakpoint
ALTER TABLE "payment_disputes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_disputes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_events_id_seq";--> statement-breakpoint
ALTER TABLE "payment_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_fee_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_fee_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_fee_rules_id_seq";--> statement-breakpoint
ALTER TABLE "payment_fee_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_fee_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_ledger_entries" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_ledger_entries" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_ledger_entries_id_seq";--> statement-breakpoint
ALTER TABLE "payment_ledger_entries" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_ledger_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_links" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_links" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_links_id_seq";--> statement-breakpoint
ALTER TABLE "payment_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_method_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_method_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_method_configs_id_seq";--> statement-breakpoint
ALTER TABLE "payment_method_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_method_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_notify_logs_id_seq";--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_notify_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_orders" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_orders" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_orders_id_seq";--> statement-breakpoint
ALTER TABLE "payment_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_preauths" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_preauths" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_preauths_id_seq";--> statement-breakpoint
ALTER TABLE "payment_preauths" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_preauths_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_recon_batches_id_seq";--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_recon_batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_recon_items" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_recon_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_recon_items_id_seq";--> statement-breakpoint
ALTER TABLE "payment_recon_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_recon_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_refunds" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_refunds" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_refunds_id_seq";--> statement-breakpoint
ALTER TABLE "payment_refunds" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_refunds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_report_daily" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_report_daily" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_report_daily_id_seq";--> statement-breakpoint
ALTER TABLE "payment_report_daily" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_report_daily_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_risk_hits" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_risk_hits" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_risk_hits_id_seq";--> statement-breakpoint
ALTER TABLE "payment_risk_hits" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_risk_hits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_risk_reviews" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_risk_reviews" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_risk_reviews_id_seq";--> statement-breakpoint
ALTER TABLE "payment_risk_reviews" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_risk_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_risk_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_risk_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_risk_rules_id_seq";--> statement-breakpoint
ALTER TABLE "payment_risk_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_risk_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_settlement_batches_id_seq";--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_settlement_batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_sharing_orders" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_sharing_orders" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_sharing_orders_id_seq";--> statement-breakpoint
ALTER TABLE "payment_sharing_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_sharing_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_sharing_receivers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_sharing_receivers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_sharing_receivers_id_seq";--> statement-breakpoint
ALTER TABLE "payment_sharing_receivers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_sharing_receivers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_transfers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_transfers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_transfers_id_seq";--> statement-breakpoint
ALTER TABLE "payment_transfers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_webhook_deliveries" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_webhook_deliveries" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_webhook_deliveries_id_seq";--> statement-breakpoint
ALTER TABLE "payment_webhook_deliveries" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_webhook_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "payment_webhook_endpoints" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "payment_webhook_endpoints" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "payment_webhook_endpoints_id_seq";--> statement-breakpoint
ALTER TABLE "payment_webhook_endpoints" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "payment_webhook_endpoints_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_agents" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_agents" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_agents_id_seq";--> statement-breakpoint
ALTER TABLE "ai_agents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_agents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_arena_votes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_arena_votes" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_arena_votes_id_seq";--> statement-breakpoint
ALTER TABLE "ai_arena_votes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_arena_votes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_conversations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_conversations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_conversations_id_seq";--> statement-breakpoint
ALTER TABLE "ai_conversations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_http_tools" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_http_tools" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_http_tools_id_seq";--> statement-breakpoint
ALTER TABLE "ai_http_tools" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_http_tools_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_kb_chunks" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_kb_chunks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_kb_chunks_id_seq";--> statement-breakpoint
ALTER TABLE "ai_kb_chunks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_kb_chunks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_kb_documents" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_kb_documents" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_kb_documents_id_seq";--> statement-breakpoint
ALTER TABLE "ai_kb_documents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_kb_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_knowledge_bases" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_knowledge_bases" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_knowledge_bases_id_seq";--> statement-breakpoint
ALTER TABLE "ai_knowledge_bases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_knowledge_bases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_messages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_messages_id_seq";--> statement-breakpoint
ALTER TABLE "ai_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_prompt_template_versions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_prompt_template_versions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_prompt_template_versions_id_seq";--> statement-breakpoint
ALTER TABLE "ai_prompt_template_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_prompt_template_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_prompt_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_prompt_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_prompt_templates_id_seq";--> statement-breakpoint
ALTER TABLE "ai_prompt_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_prompt_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_provider_configs_id_seq";--> statement-breakpoint
ALTER TABLE "ai_provider_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_provider_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_shared_conversations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_shared_conversations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_shared_conversations_id_seq";--> statement-breakpoint
ALTER TABLE "ai_shared_conversations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_shared_conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ai_user_settings" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai_user_settings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ai_user_settings_id_seq";--> statement-breakpoint
ALTER TABLE "ai_user_settings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ai_user_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "user_ai_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_ai_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "user_ai_configs_id_seq";--> statement-breakpoint
ALTER TABLE "user_ai_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "user_ai_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "api_scopes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "api_scopes" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "api_scopes_id_seq";--> statement-breakpoint
ALTER TABLE "api_scopes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "api_scopes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "app_webhook_deliveries" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "app_webhook_deliveries" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "app_webhook_deliveries_id_seq";--> statement-breakpoint
ALTER TABLE "app_webhook_deliveries" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "app_webhook_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "app_webhook_subscriptions_id_seq";--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "app_webhook_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "oauth2_authorization_codes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "oauth2_authorization_codes" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "oauth2_authorization_codes_id_seq";--> statement-breakpoint
ALTER TABLE "oauth2_authorization_codes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "oauth2_authorization_codes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "oauth2_clients" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "oauth2_clients" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "oauth2_clients_id_seq";--> statement-breakpoint
ALTER TABLE "oauth2_clients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "oauth2_clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "oauth2_tokens" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "oauth2_tokens" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "oauth2_tokens_id_seq";--> statement-breakpoint
ALTER TABLE "oauth2_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "oauth2_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "oauth2_user_grants" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "oauth2_user_grants" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "oauth2_user_grants_id_seq";--> statement-breakpoint
ALTER TABLE "oauth2_user_grants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "oauth2_user_grants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "open_api_call_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "open_api_call_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "open_api_call_logs_id_seq";--> statement-breakpoint
ALTER TABLE "open_api_call_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "open_api_call_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "open_api_call_stats_daily" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "open_api_call_stats_daily" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "open_api_call_stats_daily_id_seq";--> statement-breakpoint
ALTER TABLE "open_api_call_stats_daily" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "open_api_call_stats_daily_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "open_quota_alerts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "open_quota_alerts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "open_quota_alerts_id_seq";--> statement-breakpoint
ALTER TABLE "open_quota_alerts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "open_quota_alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "rate_plans" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "rate_plans" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "rate_plans_id_seq";--> statement-breakpoint
ALTER TABLE "rate_plans" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "rate_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ssh_profiles" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ssh_profiles" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ssh_profiles_id_seq";--> statement-breakpoint
ALTER TABLE "ssh_profiles" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ssh_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "terminal_recordings" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "terminal_recordings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "terminal_recordings_id_seq";--> statement-breakpoint
ALTER TABLE "terminal_recordings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "terminal_recordings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ops_hosts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ops_hosts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ops_hosts_id_seq";--> statement-breakpoint
ALTER TABLE "ops_hosts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ops_hosts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "checkin_milestones" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "checkin_milestones" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "checkin_milestones_id_seq";--> statement-breakpoint
ALTER TABLE "checkin_milestones" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "checkin_milestones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "checkin_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "checkin_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "checkin_rules_id_seq";--> statement-breakpoint
ALTER TABLE "checkin_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "checkin_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "checkin_settings" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "checkin_settings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "checkin_settings_id_seq";--> statement-breakpoint
ALTER TABLE "checkin_settings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "checkin_settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "coupons_id_seq";--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "coupons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_checkin_milestone_awards" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_checkin_milestone_awards" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_checkin_milestone_awards_id_seq";--> statement-breakpoint
ALTER TABLE "member_checkin_milestone_awards" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_checkin_milestone_awards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_checkins" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_checkins" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_checkins_id_seq";--> statement-breakpoint
ALTER TABLE "member_checkins" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_checkins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_coupons" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_coupons" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_coupons_id_seq";--> statement-breakpoint
ALTER TABLE "member_coupons" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_coupons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_levels" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_levels" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_levels_id_seq";--> statement-breakpoint
ALTER TABLE "member_levels" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_levels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_login_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_login_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_login_logs_id_seq";--> statement-breakpoint
ALTER TABLE "member_login_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_login_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_notifications" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_notifications" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_notifications_id_seq";--> statement-breakpoint
ALTER TABLE "member_notifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_point_accounts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_point_accounts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_point_accounts_id_seq";--> statement-breakpoint
ALTER TABLE "member_point_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_point_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_point_transactions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_point_transactions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_point_transactions_id_seq";--> statement-breakpoint
ALTER TABLE "member_point_transactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_point_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_tag_bindings" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_tag_bindings" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_tag_bindings_id_seq";--> statement-breakpoint
ALTER TABLE "member_tag_bindings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_tag_bindings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_tags" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_tags" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_tags_id_seq";--> statement-breakpoint
ALTER TABLE "member_tags" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_vip_renewals" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_vip_renewals" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_vip_renewals_id_seq";--> statement-breakpoint
ALTER TABLE "member_vip_renewals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_vip_renewals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_wallet_transactions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_wallet_transactions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_wallet_transactions_id_seq";--> statement-breakpoint
ALTER TABLE "member_wallet_transactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_wallet_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "member_wallets" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "member_wallets" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "member_wallets_id_seq";--> statement-breakpoint
ALTER TABLE "member_wallets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "member_wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "members_id_seq";--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "monitor_alert_events_id_seq";--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "monitor_alert_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "monitor_alert_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "monitor_alert_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "monitor_alert_rules_id_seq";--> statement-breakpoint
ALTER TABLE "monitor_alert_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "monitor_alert_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "ssl_certificates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ssl_certificates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "ssl_certificates_id_seq";--> statement-breakpoint
ALTER TABLE "ssl_certificates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "ssl_certificates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "system_metric_samples" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "system_metric_samples" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "system_metric_samples_id_seq";--> statement-breakpoint
ALTER TABLE "system_metric_samples" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "system_metric_samples_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "app_artifacts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "app_artifacts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "app_artifacts_id_seq";--> statement-breakpoint
ALTER TABLE "app_artifacts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "app_artifacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "app_release_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "app_release_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "app_release_events_id_seq";--> statement-breakpoint
ALTER TABLE "app_release_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "app_release_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "app_releases" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "app_releases" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "app_releases_id_seq";--> statement-breakpoint
ALTER TABLE "app_releases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "app_releases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "client_apps" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "client_apps" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "client_apps_id_seq";--> statement-breakpoint
ALTER TABLE "client_apps" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "client_apps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "client_devices" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "client_devices" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "client_devices_id_seq";--> statement-breakpoint
ALTER TABLE "client_devices" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "client_devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_accounts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_accounts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_accounts_id_seq";--> statement-breakpoint
ALTER TABLE "mp_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_auto_replies" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_auto_replies" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_auto_replies_id_seq";--> statement-breakpoint
ALTER TABLE "mp_auto_replies" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_auto_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_broadcasts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_broadcasts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_broadcasts_id_seq";--> statement-breakpoint
ALTER TABLE "mp_broadcasts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_broadcasts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_conditional_menus" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_conditional_menus" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_conditional_menus_id_seq";--> statement-breakpoint
ALTER TABLE "mp_conditional_menus" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_conditional_menus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_drafts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_drafts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_drafts_id_seq";--> statement-breakpoint
ALTER TABLE "mp_drafts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_drafts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_fans" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_fans" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_fans_id_seq";--> statement-breakpoint
ALTER TABLE "mp_fans" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_fans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_kf_accounts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_kf_accounts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_kf_accounts_id_seq";--> statement-breakpoint
ALTER TABLE "mp_kf_accounts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_kf_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_kf_routing_configs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_kf_routing_configs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_kf_routing_configs_id_seq";--> statement-breakpoint
ALTER TABLE "mp_kf_routing_configs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_kf_routing_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_kf_session_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_kf_session_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_kf_session_events_id_seq";--> statement-breakpoint
ALTER TABLE "mp_kf_session_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_kf_session_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_kf_sessions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_kf_sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_kf_sessions_id_seq";--> statement-breakpoint
ALTER TABLE "mp_kf_sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_kf_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_materials" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_materials" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_materials_id_seq";--> statement-breakpoint
ALTER TABLE "mp_materials" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_materials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_menus" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_menus" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_menus_id_seq";--> statement-breakpoint
ALTER TABLE "mp_menus" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_menus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_message_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_message_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_message_templates_id_seq";--> statement-breakpoint
ALTER TABLE "mp_message_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_message_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_messages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_messages_id_seq";--> statement-breakpoint
ALTER TABLE "mp_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_qrcodes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_qrcodes" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_qrcodes_id_seq";--> statement-breakpoint
ALTER TABLE "mp_qrcodes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_qrcodes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_tags" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_tags" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_tags_id_seq";--> statement-breakpoint
ALTER TABLE "mp_tags" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_template_send_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_template_send_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_template_send_logs_id_seq";--> statement-breakpoint
ALTER TABLE "mp_template_send_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_template_send_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "mp_unmatched_keywords" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "mp_unmatched_keywords" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "mp_unmatched_keywords_id_seq";--> statement-breakpoint
ALTER TABLE "mp_unmatched_keywords" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "mp_unmatched_keywords_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_alert_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_alert_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_alert_rules_id_seq";--> statement-breakpoint
ALTER TABLE "report_alert_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_alert_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dashboard_categories" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dashboard_categories" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dashboard_categories_id_seq";--> statement-breakpoint
ALTER TABLE "report_dashboard_categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dashboard_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dashboard_comments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dashboard_comments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dashboard_comments_id_seq";--> statement-breakpoint
ALTER TABLE "report_dashboard_comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dashboard_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dashboard_embed_tokens" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dashboard_embed_tokens" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dashboard_embed_tokens_id_seq";--> statement-breakpoint
ALTER TABLE "report_dashboard_embed_tokens" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dashboard_embed_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dashboard_shares" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dashboard_shares" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dashboard_shares_id_seq";--> statement-breakpoint
ALTER TABLE "report_dashboard_shares" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dashboard_shares_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dashboard_subscriptions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dashboard_subscriptions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dashboard_subscriptions_id_seq";--> statement-breakpoint
ALTER TABLE "report_dashboard_subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dashboard_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dashboard_versions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dashboard_versions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dashboard_versions_id_seq";--> statement-breakpoint
ALTER TABLE "report_dashboard_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dashboard_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dashboards" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dashboards" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dashboards_id_seq";--> statement-breakpoint
ALTER TABLE "report_dashboards" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dashboards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dataset_execution_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dataset_execution_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dataset_execution_logs_id_seq";--> statement-breakpoint
ALTER TABLE "report_dataset_execution_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dataset_execution_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_datasets" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_datasets" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_datasets_id_seq";--> statement-breakpoint
ALTER TABLE "report_datasets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_datasets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_datasources" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_datasources" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_datasources_id_seq";--> statement-breakpoint
ALTER TABLE "report_datasources" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_datasources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_delivery_attempts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_delivery_attempts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_delivery_attempts_id_seq";--> statement-breakpoint
ALTER TABLE "report_delivery_attempts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_delivery_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_delivery_runs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_delivery_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_delivery_runs_id_seq";--> statement-breakpoint
ALTER TABLE "report_delivery_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_delivery_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_folders" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_folders" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_folders_id_seq";--> statement-breakpoint
ALTER TABLE "report_folders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_folders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_print_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_print_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_print_templates_id_seq";--> statement-breakpoint
ALTER TABLE "report_print_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_print_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_share_access_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_share_access_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_share_access_logs_id_seq";--> statement-breakpoint
ALTER TABLE "report_share_access_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_share_access_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_asset_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_asset_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_asset_templates_id_seq";--> statement-breakpoint
ALTER TABLE "report_asset_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_asset_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_asset_usage_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_asset_usage_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_asset_usage_logs_id_seq";--> statement-breakpoint
ALTER TABLE "report_asset_usage_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_asset_usage_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_chatbi_messages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_chatbi_messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_chatbi_messages_id_seq";--> statement-breakpoint
ALTER TABLE "report_chatbi_messages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_chatbi_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_chatbi_sessions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_chatbi_sessions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_chatbi_sessions_id_seq";--> statement-breakpoint
ALTER TABLE "report_chatbi_sessions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_chatbi_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_deprecation_notices" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_deprecation_notices" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_deprecation_notices_id_seq";--> statement-breakpoint
ALTER TABLE "report_deprecation_notices" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_deprecation_notices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dq_anomalies" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dq_anomalies" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dq_anomalies_id_seq";--> statement-breakpoint
ALTER TABLE "report_dq_anomalies" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dq_anomalies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dq_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dq_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dq_rules_id_seq";--> statement-breakpoint
ALTER TABLE "report_dq_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dq_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dq_runs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dq_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dq_runs_id_seq";--> statement-breakpoint
ALTER TABLE "report_dq_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dq_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_dq_scores" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_dq_scores" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_dq_scores_id_seq";--> statement-breakpoint
ALTER TABLE "report_dq_scores" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_dq_scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_environment_promotions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_environment_promotions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_environment_promotions_id_seq";--> statement-breakpoint
ALTER TABLE "report_environment_promotions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_environment_promotions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_environments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_environments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_environments_id_seq";--> statement-breakpoint
ALTER TABLE "report_environments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_environments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_fill_records" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_fill_records" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_fill_records_id_seq";--> statement-breakpoint
ALTER TABLE "report_fill_records" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_fill_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_fill_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_fill_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_fill_templates_id_seq";--> statement-breakpoint
ALTER TABLE "report_fill_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_fill_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_materialization_snapshots" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_materialization_snapshots" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_materialization_snapshots_id_seq";--> statement-breakpoint
ALTER TABLE "report_materialization_snapshots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_materialization_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_metrics" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_metrics" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_metrics_id_seq";--> statement-breakpoint
ALTER TABLE "report_metrics" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_publish_approvals" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_publish_approvals" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_publish_approvals_id_seq";--> statement-breakpoint
ALTER TABLE "report_publish_approvals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_publish_approvals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_query_cost_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_query_cost_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_query_cost_logs_id_seq";--> statement-breakpoint
ALTER TABLE "report_query_cost_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_query_cost_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_query_quotas" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_query_quotas" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_query_quotas_id_seq";--> statement-breakpoint
ALTER TABLE "report_query_quotas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_query_quotas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_resource_acls" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_resource_acls" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_resource_acls_id_seq";--> statement-breakpoint
ALTER TABLE "report_resource_acls" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_resource_acls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_resource_transfers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_resource_transfers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_resource_transfers_id_seq";--> statement-breakpoint
ALTER TABLE "report_resource_transfers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_resource_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_sla_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_sla_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_sla_rules_id_seq";--> statement-breakpoint
ALTER TABLE "report_sla_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_sla_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "report_sla_violations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "report_sla_violations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "report_sla_violations_id_seq";--> statement-breakpoint
ALTER TABLE "report_sla_violations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "report_sla_violations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_ad_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_ad_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_ad_events_id_seq";--> statement-breakpoint
ALTER TABLE "cms_ad_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_ad_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_ad_slots" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_ad_slots" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_ad_slots_id_seq";--> statement-breakpoint
ALTER TABLE "cms_ad_slots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_ad_slots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_ad_stats" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_ad_stats" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_ad_stats_id_seq";--> statement-breakpoint
ALTER TABLE "cms_ad_stats" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_ad_stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_ads" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_ads" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_ads_id_seq";--> statement-breakpoint
ALTER TABLE "cms_ads" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_ads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_channels" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_channels" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_channels_id_seq";--> statement-breakpoint
ALTER TABLE "cms_channels" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_channels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_collect_items" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_collect_items" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_collect_items_id_seq";--> statement-breakpoint
ALTER TABLE "cms_collect_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_collect_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_collect_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_collect_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_collect_rules_id_seq";--> statement-breakpoint
ALTER TABLE "cms_collect_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_collect_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_comments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_comments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_comments_id_seq";--> statement-breakpoint
ALTER TABLE "cms_comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_content_op_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_content_op_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_content_op_logs_id_seq";--> statement-breakpoint
ALTER TABLE "cms_content_op_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_content_op_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_content_tombstones" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_content_tombstones" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_content_tombstones_id_seq";--> statement-breakpoint
ALTER TABLE "cms_content_tombstones" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_content_tombstones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_content_versions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_content_versions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_content_versions_id_seq";--> statement-breakpoint
ALTER TABLE "cms_content_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_content_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_contents" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_contents" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_contents_id_seq";--> statement-breakpoint
ALTER TABLE "cms_contents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_contents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_distribution_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_distribution_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_distribution_rules_id_seq";--> statement-breakpoint
ALTER TABLE "cms_distribution_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_distribution_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_error_prone_words" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_error_prone_words" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_error_prone_words_id_seq";--> statement-breakpoint
ALTER TABLE "cms_error_prone_words" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_error_prone_words_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_form_submissions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_form_submissions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_form_submissions_id_seq";--> statement-breakpoint
ALTER TABLE "cms_form_submissions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_form_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_forms" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_forms" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_forms_id_seq";--> statement-breakpoint
ALTER TABLE "cms_forms" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_forms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_friend_link_groups" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_friend_link_groups" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_friend_link_groups_id_seq";--> statement-breakpoint
ALTER TABLE "cms_friend_link_groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_friend_link_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_friend_links" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_friend_links" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_friend_links_id_seq";--> statement-breakpoint
ALTER TABLE "cms_friend_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_friend_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_hotword_groups" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_hotword_groups" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_hotword_groups_id_seq";--> statement-breakpoint
ALTER TABLE "cms_hotword_groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_hotword_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_hotwords" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_hotwords" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_hotwords_id_seq";--> statement-breakpoint
ALTER TABLE "cms_hotwords" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_hotwords_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_interaction_answers" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_interaction_answers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_interaction_answers_id_seq";--> statement-breakpoint
ALTER TABLE "cms_interaction_answers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_interaction_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_interaction_questions_id_seq";--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_interaction_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_interaction_responses" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_interaction_responses" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_interaction_responses_id_seq";--> statement-breakpoint
ALTER TABLE "cms_interaction_responses" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_interaction_responses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_interactions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_interactions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_interactions_id_seq";--> statement-breakpoint
ALTER TABLE "cms_interactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_interactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_link_words" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_link_words" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_link_words_id_seq";--> statement-breakpoint
ALTER TABLE "cms_link_words" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_link_words_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_member_subscriptions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_member_subscriptions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_member_subscriptions_id_seq";--> statement-breakpoint
ALTER TABLE "cms_member_subscriptions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_member_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_member_view_history" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_member_view_history" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_member_view_history_id_seq";--> statement-breakpoint
ALTER TABLE "cms_member_view_history" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_member_view_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_model_fields" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_model_fields" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_model_fields_id_seq";--> statement-breakpoint
ALTER TABLE "cms_model_fields" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_model_fields_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_models" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_models" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_models_id_seq";--> statement-breakpoint
ALTER TABLE "cms_models" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_models_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_open_app_grants" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_open_app_grants" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_open_app_grants_id_seq";--> statement-breakpoint
ALTER TABLE "cms_open_app_grants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_open_app_grants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_page_block_acls" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_page_block_acls" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_page_block_acls_id_seq";--> statement-breakpoint
ALTER TABLE "cms_page_block_acls" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_page_block_acls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_pages" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_pages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_pages_id_seq";--> statement-breakpoint
ALTER TABLE "cms_pages" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_pages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_publish_artifacts_id_seq";--> statement-breakpoint
ALTER TABLE "cms_publish_artifacts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_publish_artifacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_push_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_push_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_push_logs_id_seq";--> statement-breakpoint
ALTER TABLE "cms_push_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_push_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_redirects" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_redirects" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_redirects_id_seq";--> statement-breakpoint
ALTER TABLE "cms_redirects" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_redirects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_resource_folders" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_resource_folders" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_resource_folders_id_seq";--> statement-breakpoint
ALTER TABLE "cms_resource_folders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_resource_folders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_resource_refs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_resource_refs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_resource_refs_id_seq";--> statement-breakpoint
ALTER TABLE "cms_resource_refs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_resource_refs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_resources" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_resources" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_resources_id_seq";--> statement-breakpoint
ALTER TABLE "cms_resources" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_search_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_search_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_search_logs_id_seq";--> statement-breakpoint
ALTER TABLE "cms_search_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_search_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_search_words" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_search_words" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_search_words_id_seq";--> statement-breakpoint
ALTER TABLE "cms_search_words" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_search_words_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_sensitive_words" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_sensitive_words" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_sensitive_words_id_seq";--> statement-breakpoint
ALTER TABLE "cms_sensitive_words" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_sensitive_words_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_sites" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_sites" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_sites_id_seq";--> statement-breakpoint
ALTER TABLE "cms_sites" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_sites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_tags" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_tags" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_tags_id_seq";--> statement-breakpoint
ALTER TABLE "cms_tags" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_visit_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_visit_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_visit_logs_id_seq";--> statement-breakpoint
ALTER TABLE "cms_visit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_visit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_widget_refs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_widget_refs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_widget_refs_id_seq";--> statement-breakpoint
ALTER TABLE "cms_widget_refs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_widget_refs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_widget_source_refs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_widget_source_refs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_widget_source_refs_id_seq";--> statement-breakpoint
ALTER TABLE "cms_widget_source_refs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_widget_source_refs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "cms_widgets" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "cms_widgets" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "cms_widgets_id_seq";--> statement-breakpoint
ALTER TABLE "cms_widgets" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "cms_widgets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_comments" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_comments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_comments_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_comments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_doc_versions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_doc_versions" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_doc_versions_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_doc_versions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_doc_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_doc_views" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_doc_views" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_doc_views_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_doc_views" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_doc_views_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_docs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_docs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_docs_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_docs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_docs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_review_records" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_review_records" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_review_records_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_review_records" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_review_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_search_logs" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_search_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_search_logs_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_search_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_search_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_spaces" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_spaces" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_spaces_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_spaces" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_spaces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_tags" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_tags" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_tags_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_tags" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "wiki_templates" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "wiki_templates" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "wiki_templates_id_seq";--> statement-breakpoint
ALTER TABLE "wiki_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "wiki_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "short_link_clicks" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "short_link_clicks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "short_link_clicks_id_seq";--> statement-breakpoint
ALTER TABLE "short_link_clicks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "short_link_clicks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "short_link_daily_stats" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "short_link_daily_stats" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "short_link_daily_stats_id_seq";--> statement-breakpoint
ALTER TABLE "short_link_daily_stats" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "short_link_daily_stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "short_links" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "short_links" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "short_links_id_seq";--> statement-breakpoint
ALTER TABLE "short_links" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "short_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "marketing_campaigns_id_seq";--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "marketing_campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "marketing_participations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "marketing_participations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "marketing_participations_id_seq";--> statement-breakpoint
ALTER TABLE "marketing_participations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "marketing_participations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "marketing_prizes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "marketing_prizes" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "marketing_prizes_id_seq";--> statement-breakpoint
ALTER TABLE "marketing_prizes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "marketing_prizes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_alarm_rules_id_seq";--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_alarm_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_alarms" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_alarms" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_alarms_id_seq";--> statement-breakpoint
ALTER TABLE "iot_alarms" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_alarms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_automation_runs" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "iot_automation_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_automation_runs_id_seq";--> statement-breakpoint
ALTER TABLE "iot_automation_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_automation_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_automations" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_automations" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_automations_id_seq";--> statement-breakpoint
ALTER TABLE "iot_automations" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_automations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_commands" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_commands" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_commands_id_seq";--> statement-breakpoint
ALTER TABLE "iot_commands" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_commands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_device_events" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "iot_device_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_device_events_id_seq";--> statement-breakpoint
ALTER TABLE "iot_device_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_device_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_device_groups" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_device_groups" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_device_groups_id_seq";--> statement-breakpoint
ALTER TABLE "iot_device_groups" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_device_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_device_logs" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "iot_device_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_device_logs_id_seq";--> statement-breakpoint
ALTER TABLE "iot_device_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_device_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_device_whitelist_id_seq";--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_device_whitelist_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_devices_id_seq";--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_firmwares" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_firmwares" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_firmwares_id_seq";--> statement-breakpoint
ALTER TABLE "iot_firmwares" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_firmwares_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_forward_logs" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "iot_forward_logs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_forward_logs_id_seq";--> statement-breakpoint
ALTER TABLE "iot_forward_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_forward_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_forward_rules_id_seq";--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_forward_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_maintenance_windows_id_seq";--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_maintenance_windows_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_online_snapshots" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_online_snapshots" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_online_snapshots_id_seq";--> statement-breakpoint
ALTER TABLE "iot_online_snapshots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_online_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_ota_task_devices" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_ota_task_devices" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_ota_task_devices_id_seq";--> statement-breakpoint
ALTER TABLE "iot_ota_task_devices" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_ota_task_devices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_ota_tasks_id_seq";--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_ota_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_product_events" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_product_events" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_product_events_id_seq";--> statement-breakpoint
ALTER TABLE "iot_product_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_product_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_product_properties" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_product_properties" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_product_properties_id_seq";--> statement-breakpoint
ALTER TABLE "iot_product_properties" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_product_properties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_product_services" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_product_services" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_product_services_id_seq";--> statement-breakpoint
ALTER TABLE "iot_product_services" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_product_services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_products" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_products" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_products_id_seq";--> statement-breakpoint
ALTER TABLE "iot_products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_schedule_runs" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "iot_schedule_runs" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_schedule_runs_id_seq";--> statement-breakpoint
ALTER TABLE "iot_schedule_runs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_schedule_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_schedules" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "iot_schedules" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_schedules_id_seq";--> statement-breakpoint
ALTER TABLE "iot_schedules" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_schedules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_telemetry" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "iot_telemetry" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_telemetry_id_seq";--> statement-breakpoint
ALTER TABLE "iot_telemetry" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_telemetry_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "iot_telemetry_hourly" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "iot_telemetry_hourly" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "iot_telemetry_hourly_id_seq";--> statement-breakpoint
ALTER TABLE "iot_telemetry_hourly" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "iot_telemetry_hourly_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);
--> statement-breakpoint
-- 存量数据续位：所有 identity 序列从 MAX(id)+1 继续（空表从 1 开始）
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE a.attidentity = 'a' AND n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), GREATEST((SELECT COALESCE(MAX(%I), 0) FROM %I), 0) + 1, false)',
      r.tbl, r.col, r.col, r.tbl
    );
  END LOOP;
END $$;
