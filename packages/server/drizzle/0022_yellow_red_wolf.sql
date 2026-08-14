ALTER TABLE "wiki_docs" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD COLUMN "expire_at" timestamp;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD COLUMN "review_cycle_days" integer;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD COLUMN "next_review_at" timestamp;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD CONSTRAINT "wiki_docs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;