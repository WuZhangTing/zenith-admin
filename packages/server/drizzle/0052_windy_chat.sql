CREATE TYPE "public"."ops_host_auth_type" AS ENUM('password', 'key_content');--> statement-breakpoint
CREATE TYPE "public"."ops_host_status" AS ENUM('unknown', 'online', 'offline');--> statement-breakpoint
CREATE TABLE "ops_hosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer DEFAULT 22 NOT NULL,
	"username" varchar(64) NOT NULL,
	"auth_type" "ops_host_auth_type" DEFAULT 'password' NOT NULL,
	"password_encrypted" text,
	"key_content_encrypted" text,
	"key_passphrase_encrypted" text,
	"host_key_fingerprint" varchar(64),
	"status" "ops_host_status" DEFAULT 'unknown' NOT NULL,
	"snapshot" jsonb,
	"probed_at" timestamp,
	"probe_error" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	CONSTRAINT "ops_hosts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "ops_hosts" ADD CONSTRAINT "ops_hosts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_hosts" ADD CONSTRAINT "ops_hosts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ops_hosts_enabled_idx" ON "ops_hosts" USING btree ("enabled","status");