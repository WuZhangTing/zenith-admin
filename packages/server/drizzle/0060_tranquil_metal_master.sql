CREATE TABLE "replay_access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"replay_id" varchar(36) NOT NULL,
	"replay_owner" varchar(64),
	"user_id" integer NOT NULL,
	"username" varchar(64),
	"action" varchar(16) DEFAULT 'view' NOT NULL,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "replay_access_logs" ADD CONSTRAINT "replay_access_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replay_access_logs_replay_idx" ON "replay_access_logs" USING btree ("replay_id");--> statement-breakpoint
CREATE INDEX "replay_access_logs_user_idx" ON "replay_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "replay_access_logs_created_idx" ON "replay_access_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "replay_access_logs_tenant_idx" ON "replay_access_logs" USING btree ("tenant_id");