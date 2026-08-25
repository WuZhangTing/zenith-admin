ALTER TABLE "ai_messages" ADD COLUMN "tool_calls" jsonb;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "kb_references" jsonb;