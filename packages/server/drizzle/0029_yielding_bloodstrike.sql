ALTER TABLE "payment_disputes" ADD COLUMN "route" varchar(32);--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD COLUMN "priority" integer;--> statement-breakpoint
ALTER TABLE "payment_disputes" ADD COLUMN "sla_hours" integer;--> statement-breakpoint
CREATE INDEX "payment_disputes_route_idx" ON "payment_disputes" USING btree ("route");