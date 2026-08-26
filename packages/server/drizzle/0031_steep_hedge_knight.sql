CREATE TYPE "public"."push_provider" AS ENUM('jpush');--> statement-breakpoint
CREATE TABLE "push_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"provider" "push_provider" DEFAULT 'jpush' NOT NULL,
	"app_key" varchar(128) DEFAULT '' NOT NULL,
	"master_secret" varchar(256) DEFAULT '' NOT NULL,
	"apns_production" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"remark" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_send_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_id" integer,
	"provider" "push_provider" NOT NULL,
	"subject_type" varchar(16),
	"subject_id" integer,
	"device_count" integer DEFAULT 0 NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"link" varchar(500),
	"event_key" varchar(128),
	"status" "send_status" DEFAULT 'pending' NOT NULL,
	"provider_msg_id" varchar(128),
	"error_msg" text,
	"source" "send_source" DEFAULT 'system' NOT NULL,
	"tenant_id" integer,
	"sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"app_id" integer NOT NULL,
	"platform" "app_platform" NOT NULL,
	"arch" "app_arch",
	"device_model" varchar(128),
	"os_version" varchar(64),
	"app_version" varchar(32),
	"subject_type" varchar(16),
	"subject_id" integer,
	"push_provider" "push_provider",
	"push_registration_id" varchar(128),
	"push_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
ALTER TABLE "push_configs" ADD CONSTRAINT "push_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_configs" ADD CONSTRAINT "push_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_send_logs" ADD CONSTRAINT "push_send_logs_config_id_push_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."push_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_send_logs" ADD CONSTRAINT "push_send_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_devices" ADD CONSTRAINT "client_devices_app_id_client_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."client_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_send_logs_created_at_idx" ON "push_send_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "push_send_logs_status_idx" ON "push_send_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "push_send_logs_subject_idx" ON "push_send_logs" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "client_devices_app_active_idx" ON "client_devices" USING btree ("app_id","last_active_at");--> statement-breakpoint
CREATE INDEX "client_devices_subject_idx" ON "client_devices" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_devices_push_reg_unique" ON "client_devices" USING btree ("push_provider","push_registration_id");