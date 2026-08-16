DROP INDEX "payment_ledger_refund_uq";--> statement-breakpoint
DROP INDEX "payment_ledger_order_type_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "payment_ledger_refund_type_uq" ON "payment_ledger_entries" USING btree ("refund_no","type") WHERE "payment_ledger_entries"."refund_no" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_ledger_order_type_uq" ON "payment_ledger_entries" USING btree ("order_no","type") WHERE "payment_ledger_entries"."order_no" is not null and "payment_ledger_entries"."refund_no" is null and "payment_ledger_entries"."type" in ('payment', 'fee');