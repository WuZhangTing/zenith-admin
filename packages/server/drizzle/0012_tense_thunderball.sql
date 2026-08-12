ALTER TABLE "monitor_alert_rules" ADD COLUMN "recipient_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monitor_alert_rules" ADD COLUMN "recipient_emails" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "monitor_alert_rules" AS "rule"
SET
  "recipient_user_ids" = COALESCE((
    SELECT jsonb_agg("matched"."user_id" ORDER BY "matched"."user_id")
    FROM (
      SELECT DISTINCT "user"."id" AS "user_id"
      FROM "users" AS "user"
      JOIN LATERAL jsonb_array_elements_text("rule"."recipients") AS "recipient"("value") ON true
      WHERE "user"."status" = 'enabled'
        AND "user"."tenant_id" IS NOT DISTINCT FROM "rule"."tenant_id"
        AND (
          lower("user"."username") = lower("recipient"."value")
          OR lower("user"."email") = lower("recipient"."value")
        )
    ) AS "matched"
  ), '[]'::jsonb),
  "recipient_emails" = COALESCE((
    SELECT jsonb_agg("explicit"."email" ORDER BY "explicit"."email")
    FROM (
      SELECT DISTINCT lower(trim("recipient"."value")) AS "email"
      FROM jsonb_array_elements_text("rule"."recipients") AS "recipient"("value")
      WHERE "recipient"."value" LIKE '%@%'
    ) AS "explicit"
  ), '[]'::jsonb);--> statement-breakpoint
UPDATE "monitor_alert_rules"
SET "enabled" = false, "state" = 'ok', "breaching_since" = NULL
WHERE (
  "channels" ? 'inapp'
  AND jsonb_array_length("recipient_user_ids") = 0
) OR (
  "channels" ? 'email'
  AND jsonb_array_length("recipient_user_ids") = 0
  AND jsonb_array_length("recipient_emails") = 0
);--> statement-breakpoint
ALTER TABLE "monitor_alert_rules" DROP COLUMN "recipients";