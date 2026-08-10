ALTER TYPE "public"."monitor_metric" ADD VALUE 'paymentFailureRate';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'paymentStuckPaying';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'paymentReconDiff';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'paymentEventBacklog';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'paymentWebhookFailureRate';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'openApiErrorRate';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'openApiAppErrorRate';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'openWebhookFailureRate';--> statement-breakpoint
ALTER TYPE "public"."monitor_metric" ADD VALUE 'openWebhookDisabledSubs';