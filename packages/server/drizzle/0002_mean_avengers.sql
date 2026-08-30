ALTER TYPE "public"."payment_ledger_type" ADD VALUE 'sharing' BEFORE 'settlement';--> statement-breakpoint
ALTER TABLE "payment_ledger_entries" ADD COLUMN "sharing_no" varchar(64);--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD COLUMN "sharing_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_ledger_sharing_type_uq" ON "payment_ledger_entries" USING btree ("sharing_no","type") WHERE "payment_ledger_entries"."sharing_no" is not null;