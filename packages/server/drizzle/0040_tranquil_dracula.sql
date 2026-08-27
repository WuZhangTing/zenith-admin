CREATE TYPE "public"."iot_command_status" AS ENUM('pending', 'delivered', 'acked', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "iot_commands" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"service" varchar(64) NOT NULL,
	"params" jsonb,
	"status" "iot_command_status" DEFAULT 'pending' NOT NULL,
	"expire_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"acked_at" timestamp,
	"response" jsonb,
	"error_msg" varchar(256),
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"sn" varchar(64) NOT NULL,
	"secret" varchar(64) NOT NULL,
	"product_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"firmware_version" varchar(32),
	"activated_at" timestamp,
	"last_seen_at" timestamp,
	"remark" varchar(256),
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "iot_devices_sn_unique" UNIQUE("sn")
);
--> statement-breakpoint
CREATE TABLE "iot_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"key_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_telemetry" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"metrics" jsonb NOT NULL,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iot_commands" ADD CONSTRAINT "iot_commands_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_commands" ADD CONSTRAINT "iot_commands_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_commands" ADD CONSTRAINT "iot_commands_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_products" ADD CONSTRAINT "iot_products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_products" ADD CONSTRAINT "iot_products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_products" ADD CONSTRAINT "iot_products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_telemetry" ADD CONSTRAINT "iot_telemetry_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iot_commands_device_time" ON "iot_commands" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_iot_commands_status" ON "iot_commands" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_iot_devices_product" ON "iot_devices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_iot_devices_tenant" ON "iot_devices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_iot_products_tenant" ON "iot_products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_iot_telemetry_device_time" ON "iot_telemetry" USING btree ("device_id","reported_at");