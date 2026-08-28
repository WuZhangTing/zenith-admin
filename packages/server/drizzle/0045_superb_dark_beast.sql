CREATE TYPE "public"."iot_forward_source" AS ENUM('telemetry', 'event', 'alarm', 'lifecycle');--> statement-breakpoint
CREATE TYPE "public"."iot_forward_status" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."iot_log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."iot_node_type" AS ENUM('direct', 'gateway', 'sub');--> statement-breakpoint
CREATE TABLE "iot_device_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"level" "iot_log_level" DEFAULT 'info' NOT NULL,
	"tag" varchar(64),
	"content" varchar(1024) NOT NULL,
	"reported_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_forward_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"rule_name" varchar(128) NOT NULL,
	"source" "iot_forward_source" NOT NULL,
	"device_id" integer,
	"payload" jsonb NOT NULL,
	"status" "iot_forward_status" NOT NULL,
	"response_status" integer,
	"error_message" varchar(512),
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_forward_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"source" "iot_forward_source" NOT NULL,
	"product_id" integer,
	"group_id" integer,
	"url" varchar(512) NOT NULL,
	"secret" varchar(128),
	"headers" jsonb,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"auto_disabled_at" timestamp,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "node_type" "iot_node_type" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "gateway_id" integer;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "address" varchar(256);--> statement-breakpoint
ALTER TABLE "iot_product_properties" ADD COLUMN "anomaly_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_device_logs" ADD CONSTRAINT "iot_device_logs_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_forward_logs" ADD CONSTRAINT "iot_forward_logs_rule_id_iot_forward_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."iot_forward_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ADD CONSTRAINT "iot_forward_rules_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ADD CONSTRAINT "iot_forward_rules_group_id_iot_device_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."iot_device_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ADD CONSTRAINT "iot_forward_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ADD CONSTRAINT "iot_forward_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_forward_rules" ADD CONSTRAINT "iot_forward_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iot_device_logs_device" ON "iot_device_logs" USING btree ("device_id","reported_at");--> statement-breakpoint
CREATE INDEX "idx_iot_device_logs_level" ON "iot_device_logs" USING btree ("device_id","level");--> statement-breakpoint
CREATE INDEX "idx_iot_forward_logs_rule" ON "iot_forward_logs" USING btree ("rule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_iot_forward_rules_source" ON "iot_forward_rules" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_iot_forward_rules_tenant" ON "iot_forward_rules" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_gateway_id_iot_devices_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."iot_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iot_devices_gateway" ON "iot_devices" USING btree ("gateway_id");