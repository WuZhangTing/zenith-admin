CREATE TYPE "public"."terminal_session_kind" AS ENUM('local', 'ssh', 'docker');--> statement-breakpoint
CREATE TYPE "public"."terminal_session_state" AS ENUM('active', 'detached', 'terminated', 'failed');--> statement-breakpoint
CREATE TABLE "terminal_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tenant_id" integer,
	"kind" "terminal_session_kind" NOT NULL,
	"target" varchar(255) DEFAULT '' NOT NULL,
	"label" varchar(255) DEFAULT '' NOT NULL,
	"client_ip" varchar(64) DEFAULT '' NOT NULL,
	"node_id" varchar(128) NOT NULL,
	"state" "terminal_session_state" DEFAULT 'active' NOT NULL,
	"cols" integer DEFAULT 80 NOT NULL,
	"rows" integer DEFAULT 24 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"end_reason" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "terminal_sessions_user_state_idx" ON "terminal_sessions" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "terminal_sessions_tenant_started_idx" ON "terminal_sessions" USING btree ("tenant_id","started_at");--> statement-breakpoint
CREATE INDEX "terminal_sessions_node_state_idx" ON "terminal_sessions" USING btree ("node_id","state");