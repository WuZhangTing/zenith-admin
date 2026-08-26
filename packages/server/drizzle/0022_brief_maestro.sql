CREATE TABLE "rule_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref_kind" varchar(16) NOT NULL,
	"ref_id" integer,
	"rule_key" varchar(64) NOT NULL,
	"version" integer,
	"caller" varchar(64),
	"instance_id" integer,
	"node_key" varchar(64),
	"source" varchar(16) DEFAULT 'runtime' NOT NULL,
	"matched" boolean DEFAULT false NOT NULL,
	"hit_policy" "rule_hit_policy",
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"matched_row_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" integer,
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rule_executions_tenant_idx" ON "rule_executions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "rule_executions_instance_idx" ON "rule_executions" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "rule_executions_ref_idx" ON "rule_executions" USING btree ("ref_kind","ref_id");--> statement-breakpoint
CREATE INDEX "rule_executions_caller_idx" ON "rule_executions" USING btree ("caller");