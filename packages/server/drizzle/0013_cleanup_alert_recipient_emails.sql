UPDATE "monitor_alert_rules" AS "rule"
SET "recipient_emails" = COALESCE((
  SELECT jsonb_agg("remaining"."email" ORDER BY "remaining"."email")
  FROM (
    SELECT DISTINCT lower(trim("recipient"."value")) AS "email"
    FROM jsonb_array_elements_text("rule"."recipient_emails") AS "recipient"("value")
    WHERE NOT EXISTS (
      SELECT 1
      FROM "users" AS "user"
      WHERE "rule"."recipient_user_ids" @> jsonb_build_array("user"."id")
        AND lower("user"."email") = lower("recipient"."value")
    )
  ) AS "remaining"
), '[]'::jsonb)
WHERE jsonb_array_length("rule"."recipient_emails") > 0;