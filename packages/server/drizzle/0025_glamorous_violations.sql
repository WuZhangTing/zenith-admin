CREATE TABLE "rule_asset_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref_kind" varchar(16) NOT NULL,
	"ref_id" integer NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_by" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" integer,
	CONSTRAINT "rule_asset_versions_uniq" UNIQUE("ref_kind","ref_id","version")
);
--> statement-breakpoint
ALTER TABLE "rule_asset_versions" ADD CONSTRAINT "rule_asset_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_asset_versions" ADD CONSTRAINT "rule_asset_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rule_asset_versions_tenant_idx" ON "rule_asset_versions" USING btree ("tenant_id");