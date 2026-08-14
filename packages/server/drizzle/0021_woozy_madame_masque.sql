CREATE TYPE "public"."wiki_review_action" AS ENUM('submit', 'approve', 'reject', 'withdraw');--> statement-breakpoint
CREATE TABLE "wiki_doc_read_receipts" (
	"doc_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_doc_read_receipts_doc_id_user_id_pk" PRIMARY KEY("doc_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_doc_subscriptions" (
	"doc_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wiki_doc_subscriptions_doc_id_user_id_pk" PRIMARY KEY("doc_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_review_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"version" integer NOT NULL,
	"action" "wiki_review_action" NOT NULL,
	"actor_id" integer,
	"reason" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_comments" ADD COLUMN "mentioned_user_ids" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "wiki_comments" ADD COLUMN "is_question" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wiki_comments" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "wiki_docs" ADD COLUMN "require_read_receipt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wiki_doc_read_receipts" ADD CONSTRAINT "wiki_doc_read_receipts_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_read_receipts" ADD CONSTRAINT "wiki_doc_read_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_subscriptions" ADD CONSTRAINT "wiki_doc_subscriptions_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_doc_subscriptions" ADD CONSTRAINT "wiki_doc_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_review_records" ADD CONSTRAINT "wiki_review_records_doc_id_wiki_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."wiki_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_review_records" ADD CONSTRAINT "wiki_review_records_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wiki_review_records_doc_idx" ON "wiki_review_records" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "wiki_review_records_actor_idx" ON "wiki_review_records" USING btree ("actor_id");