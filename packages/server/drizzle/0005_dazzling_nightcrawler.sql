CREATE TABLE "workflow_automation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer,
	"rule_name" varchar(128) NOT NULL,
	"instance_id" integer,
	"instance_title" varchar(256),
	"trigger" "workflow_automation_trigger" NOT NULL,
	"action_index" integer NOT NULL,
	"action_type" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"error" varchar(512),
	"duration_ms" integer,
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_automation_runs" ADD CONSTRAINT "workflow_automation_runs_rule_id_workflow_automations_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."workflow_automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_automation_runs" ADD CONSTRAINT "workflow_automation_runs_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_automation_runs" ADD CONSTRAINT "workflow_automation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_automation_runs_rule_idx" ON "workflow_automation_runs" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "workflow_automation_runs_instance_idx" ON "workflow_automation_runs" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "workflow_automation_runs_created_idx" ON "workflow_automation_runs" USING btree ("created_at");