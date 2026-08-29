CREATE TABLE "replay_click_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"page_path" varchar(256) NOT NULL,
	"x_pct" smallint NOT NULL,
	"y_pct" smallint NOT NULL,
	"source" "analytics_event_source" DEFAULT 'web_admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "replay_click_points" ADD CONSTRAINT "replay_click_points_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replay_click_points_page_idx" ON "replay_click_points" USING btree ("page_path");--> statement-breakpoint
CREATE INDEX "replay_click_points_created_idx" ON "replay_click_points" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "replay_click_points_tenant_idx" ON "replay_click_points" USING btree ("tenant_id");