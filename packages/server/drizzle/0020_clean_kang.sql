CREATE TABLE "rule_scorecards" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"status" "workflow_definition_status" DEFAULT 'draft' NOT NULL,
	"base_score" integer DEFAULT 0 NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_snapshot" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rule_scorecards_key_uniq" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
ALTER TABLE "rule_decision_tables" ADD COLUMN "gray_percent" integer;--> statement-breakpoint
ALTER TABLE "rule_decision_tables" ADD COLUMN "gray_dimension" varchar(200);--> statement-breakpoint
ALTER TABLE "rule_decision_tables" ADD COLUMN "gray_version" integer;--> statement-breakpoint
ALTER TABLE "rule_list_items" ADD COLUMN "match_mode" varchar(8) DEFAULT 'exact' NOT NULL;--> statement-breakpoint
ALTER TABLE "rule_scorecards" ADD CONSTRAINT "rule_scorecards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_scorecards" ADD CONSTRAINT "rule_scorecards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_scorecards" ADD CONSTRAINT "rule_scorecards_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;