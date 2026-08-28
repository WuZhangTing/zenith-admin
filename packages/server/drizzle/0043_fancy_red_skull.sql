CREATE TYPE "public"."iot_automation_trigger" AS ENUM('property', 'event', 'online', 'offline');--> statement-breakpoint
CREATE TABLE "iot_automation_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"automation_id" integer NOT NULL,
	"automation_name" varchar(128) NOT NULL,
	"device_id" integer NOT NULL,
	"trigger_context" jsonb NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"product_id" integer NOT NULL,
	"device_id" integer,
	"trigger_type" "iot_automation_trigger" NOT NULL,
	"property_identifier" varchar(64),
	"operator" "iot_compare_op",
	"threshold" double precision,
	"event_identifier" varchar(64),
	"decision_table_id" integer,
	"cooldown_seconds" integer DEFAULT 60 NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iot_automation_runs" ADD CONSTRAINT "iot_automation_runs_automation_id_iot_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."iot_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_automation_runs" ADD CONSTRAINT "iot_automation_runs_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_automations" ADD CONSTRAINT "iot_automations_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_automations" ADD CONSTRAINT "iot_automations_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_automations" ADD CONSTRAINT "iot_automations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_automations" ADD CONSTRAINT "iot_automations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_automations" ADD CONSTRAINT "iot_automations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iot_automation_runs_automation" ON "iot_automation_runs" USING btree ("automation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_iot_automation_runs_device" ON "iot_automation_runs" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_iot_automations_product" ON "iot_automations" USING btree ("product_id");