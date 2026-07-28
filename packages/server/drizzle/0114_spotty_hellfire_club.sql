ALTER TYPE "public"."cms_interaction_question_type" ADD VALUE 'rating';--> statement-breakpoint
ALTER TYPE "public"."cms_interaction_question_type" ADD VALUE 'nps';--> statement-breakpoint
ALTER TYPE "public"."cms_interaction_question_type" ADD VALUE 'matrix';--> statement-breakpoint
ALTER TYPE "public"."cms_interaction_question_type" ADD VALUE 'date';--> statement-breakpoint
ALTER TYPE "public"."cms_interaction_question_type" ADD VALUE 'number';--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ADD COLUMN "allow_other" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ADD COLUMN "other_label" varchar(50);--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ADD COLUMN "rating_max" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ADD COLUMN "matrix_rows" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ADD COLUMN "page_no" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_interaction_questions" ADD COLUMN "visible_when" jsonb;