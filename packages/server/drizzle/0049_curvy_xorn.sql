ALTER TABLE "async_tasks" ADD COLUMN "trace_id" varchar(64);--> statement-breakpoint
CREATE INDEX "async_tasks_trace_idx" ON "async_tasks" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "operation_logs_request_idx" ON "operation_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "notification_outbox_trace_idx" ON "notification_outbox" USING btree ("trace_id");