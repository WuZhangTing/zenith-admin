CREATE TYPE "public"."iot_access_mode" AS ENUM('r', 'rw');--> statement-breakpoint
CREATE TYPE "public"."iot_alarm_level" AS ENUM('warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."iot_alarm_rule_type" AS ENUM('threshold', 'offline', 'event');--> statement-breakpoint
CREATE TYPE "public"."iot_alarm_status" AS ENUM('firing', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."iot_compare_op" AS ENUM('gt', 'gte', 'lt', 'lte', 'eq', 'neq');--> statement-breakpoint
CREATE TYPE "public"."iot_device_event_kind" AS ENUM('lifecycle', 'model');--> statement-breakpoint
CREATE TYPE "public"."iot_event_level" AS ENUM('info', 'warn', 'fault');--> statement-breakpoint
CREATE TYPE "public"."iot_property_type" AS ENUM('number', 'string', 'boolean', 'enum');--> statement-breakpoint
CREATE TYPE "public"."iot_validation_mode" AS ENUM('loose', 'strict');--> statement-breakpoint
CREATE TABLE "iot_alarm_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"product_id" integer NOT NULL,
	"device_id" integer,
	"rule_type" "iot_alarm_rule_type" NOT NULL,
	"property_identifier" varchar(64),
	"operator" "iot_compare_op",
	"threshold" double precision,
	"consecutive_count" integer DEFAULT 1 NOT NULL,
	"offline_minutes" integer,
	"event_identifier" varchar(64),
	"level" "iot_alarm_level" DEFAULT 'warning' NOT NULL,
	"notify_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_alarms" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer,
	"rule_name" varchar(128) NOT NULL,
	"device_id" integer NOT NULL,
	"rule_type" "iot_alarm_rule_type" NOT NULL,
	"level" "iot_alarm_level" NOT NULL,
	"status" "iot_alarm_status" DEFAULT 'firing' NOT NULL,
	"message" varchar(512) NOT NULL,
	"context" jsonb,
	"fired_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_device_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"kind" "iot_device_event_kind" NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"level" "iot_event_level" DEFAULT 'info' NOT NULL,
	"payload" jsonb,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_device_group_members" (
	"group_id" integer NOT NULL,
	"device_id" integer NOT NULL,
	CONSTRAINT "iot_device_group_members_group_id_device_id_pk" PRIMARY KEY("group_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "iot_device_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(256),
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_device_state" (
	"device_id" integer PRIMARY KEY NOT NULL,
	"reported" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reported_at" timestamp,
	"desired" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"desired_version" integer DEFAULT 0 NOT NULL,
	"desired_at" timestamp,
	"online" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_product_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"level" "iot_event_level" DEFAULT 'info' NOT NULL,
	"params" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"description" varchar(256),
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_product_properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"data_type" "iot_property_type" NOT NULL,
	"access_mode" "iot_access_mode" DEFAULT 'r' NOT NULL,
	"unit" varchar(16),
	"min_value" double precision,
	"max_value" double precision,
	"enum_options" jsonb,
	"featured" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"description" varchar(256),
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_product_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"params" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"danger" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"description" varchar(256),
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iot_products" ADD COLUMN "validation_mode" "iot_validation_mode" DEFAULT 'loose' NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ADD CONSTRAINT "iot_alarm_rules_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ADD CONSTRAINT "iot_alarm_rules_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ADD CONSTRAINT "iot_alarm_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ADD CONSTRAINT "iot_alarm_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ADD CONSTRAINT "iot_alarm_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_alarms" ADD CONSTRAINT "iot_alarms_rule_id_iot_alarm_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."iot_alarm_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_alarms" ADD CONSTRAINT "iot_alarms_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_events" ADD CONSTRAINT "iot_device_events_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_group_members" ADD CONSTRAINT "iot_device_group_members_group_id_iot_device_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."iot_device_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_group_members" ADD CONSTRAINT "iot_device_group_members_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_groups" ADD CONSTRAINT "iot_device_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_groups" ADD CONSTRAINT "iot_device_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_groups" ADD CONSTRAINT "iot_device_groups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_state" ADD CONSTRAINT "iot_device_state_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_events" ADD CONSTRAINT "iot_product_events_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_events" ADD CONSTRAINT "iot_product_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_events" ADD CONSTRAINT "iot_product_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_properties" ADD CONSTRAINT "iot_product_properties_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_properties" ADD CONSTRAINT "iot_product_properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_properties" ADD CONSTRAINT "iot_product_properties_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_services" ADD CONSTRAINT "iot_product_services_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_services" ADD CONSTRAINT "iot_product_services_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_product_services" ADD CONSTRAINT "iot_product_services_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iot_alarm_rules_product" ON "iot_alarm_rules" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_iot_alarms_device_time" ON "iot_alarms" USING btree ("device_id","fired_at");--> statement-breakpoint
CREATE INDEX "idx_iot_alarms_status" ON "iot_alarms" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_alarms_active" ON "iot_alarms" USING btree ("rule_id","device_id") WHERE status = 'firing';--> statement-breakpoint
CREATE INDEX "idx_iot_device_events_device_time" ON "iot_device_events" USING btree ("device_id","reported_at");--> statement-breakpoint
CREATE INDEX "idx_iot_device_groups_tenant" ON "iot_device_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_product_events_ident" ON "iot_product_events" USING btree ("product_id","identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_product_properties_ident" ON "iot_product_properties" USING btree ("product_id","identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_product_services_ident" ON "iot_product_services" USING btree ("product_id","identifier");--> statement-breakpoint
ALTER TABLE "iot_products" DROP COLUMN "key_metrics";