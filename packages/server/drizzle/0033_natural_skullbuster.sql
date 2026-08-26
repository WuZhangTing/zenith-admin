ALTER TABLE "push_configs" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "push_send_logs" ADD COLUMN "app_id" integer;--> statement-breakpoint
ALTER TABLE "push_configs" ADD CONSTRAINT "push_configs_app_id_client_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."client_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_send_logs" ADD CONSTRAINT "push_send_logs_app_id_client_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."client_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_configs" ADD CONSTRAINT "push_configs_app_unique" UNIQUE("app_id");