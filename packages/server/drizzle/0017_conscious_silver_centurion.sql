CREATE TABLE "user_ai_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(100),
	"provider_id" varchar(50) DEFAULT 'custom' NOT NULL,
	"base_url" varchar(500),
	"api_key" varchar(1000),
	"headers" jsonb,
	"models" text[] DEFAULT '{}' NOT NULL,
	"default_model" varchar(100),
	"model_settings" jsonb,
	"provider_options" jsonb,
	"capabilities" jsonb,
	"system_prompt" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_ai_configs" ADD CONSTRAINT "user_ai_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_ai_configs_user_idx" ON "user_ai_configs" USING btree ("user_id");