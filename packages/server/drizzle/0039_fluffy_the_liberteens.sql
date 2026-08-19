CREATE TABLE "license_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" integer,
	"type" varchar(40) NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_id" varchar(64) NOT NULL,
	"envelope" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"key_id" varchar(32) NOT NULL,
	"edition" varchar(20) NOT NULL,
	"customer_name" varchar(200) NOT NULL,
	"features" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"grace_until" timestamp NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"activated_by" integer,
	"last_verified_at" timestamp,
	"invalid_reason" text,
	"replaced_by_id" integer,
	CONSTRAINT "licenses_license_id_unique" UNIQUE("license_id")
);
--> statement-breakpoint
CREATE TABLE "system_installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"installation_id" varchar(64) NOT NULL,
	"license_epoch" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_installations_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
CREATE INDEX "license_events_created_idx" ON "license_events" USING btree ("created_at");