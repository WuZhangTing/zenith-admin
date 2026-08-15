CREATE TABLE "analytics_identity_map" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"anonymous_id" varchar(64) NOT NULL,
	"distinct_id" varchar(64) NOT NULL,
	"identity_type" "analytics_identity_type" NOT NULL,
	"user_id" integer,
	"member_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_identity_map" ADD CONSTRAINT "analytics_identity_map_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_identity_map_tenant_anon_uq" ON "analytics_identity_map" USING btree (coalesce("tenant_id", 0),"anonymous_id");--> statement-breakpoint
CREATE INDEX "user_events_anon_pending_idx" ON "user_events" USING btree ("anonymous_id") WHERE "user_events"."user_id" IS NULL AND "user_events"."member_id" IS NULL AND "user_events"."anonymous_id" IS NOT NULL;