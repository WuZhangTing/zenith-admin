ALTER TYPE "public"."business_type" ADD VALUE 'wiki_doc';--> statement-breakpoint
CREATE TABLE "wiki_search_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" varchar(200) NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"clicked_doc_id" integer,
	"user_id" integer,
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_search_logs" ADD CONSTRAINT "wiki_search_logs_clicked_doc_id_wiki_docs_id_fk" FOREIGN KEY ("clicked_doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_search_logs" ADD CONSTRAINT "wiki_search_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_search_logs" ADD CONSTRAINT "wiki_search_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wiki_search_logs_created_idx" ON "wiki_search_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wiki_search_logs_keyword_idx" ON "wiki_search_logs" USING btree ("keyword");--> statement-breakpoint
CREATE INDEX "wiki_docs_title_trgm_idx" ON "wiki_docs" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "wiki_docs_content_trgm_idx" ON "wiki_docs" USING gin ("content" gin_trgm_ops);