ALTER TYPE "public"."monitor_metric" ADD VALUE 'logErrorPerMin' BEFORE 'workflowHealth';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'logWarnPerMin' BEFORE 'workflowHealth';