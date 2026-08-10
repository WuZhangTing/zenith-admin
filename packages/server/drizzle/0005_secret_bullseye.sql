CREATE TABLE "retention_policies" (
	"policy_key" varchar(128) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"retention_days" integer NOT NULL,
	"batch_size" integer DEFAULT 5000 NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_deleted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "upload_sessions_created_at_idx" ON "upload_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cron_job_logs_started_at_idx" ON "cron_job_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "cron_job_logs_job_idx" ON "cron_job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ip_access_logs_created_at_idx" ON "ip_access_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ip_access_logs_ip_idx" ON "ip_access_logs" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "login_logs_created_at_idx" ON "login_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_logs_user_idx" ON "login_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_logs_status_idx" ON "login_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "operation_logs_user_idx" ON "operation_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "operation_logs_module_idx" ON "operation_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "email_send_logs_created_at_idx" ON "email_send_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_send_logs_status_idx" ON "email_send_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "in_app_messages_user_created_idx" ON "in_app_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "in_app_messages_created_at_idx" ON "in_app_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sms_send_logs_created_at_idx" ON "sms_send_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sms_send_logs_status_idx" ON "sms_send_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "db_admin_query_history_executed_at_idx" ON "db_admin_query_history" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "db_admin_query_history_user_idx" ON "db_admin_query_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_eval_runs_created_at_idx" ON "ai_eval_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_eval_runs_set_idx" ON "ai_eval_runs" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_messages_created_at_idx" ON "ai_messages" USING btree ("created_at");