CREATE TABLE "error_group_identities" (
	"group_id" integer NOT NULL,
	"identity" varchar(80) NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_group_identities_group_id_identity_pk" PRIMARY KEY("group_id","identity")
);
--> statement-breakpoint
ALTER TABLE "error_group_identities" ADD CONSTRAINT "error_group_identities_group_id_error_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."error_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "error_group_identities" ("group_id", "identity", "first_seen_at")
SELECT e."group_id",
       CASE
         WHEN e."user_id" IS NOT NULL THEN 'u:' || e."user_id"::text
         WHEN e."member_id" IS NOT NULL THEN 'm:' || e."member_id"::text
         ELSE 'a:' || e."session_id"
       END,
       MIN(e."created_at")
FROM "error_events" e
WHERE e."user_id" IS NOT NULL OR e."member_id" IS NOT NULL OR e."session_id" IS NOT NULL
GROUP BY 1, 2
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "error_groups" g
SET "affected_users" = COALESCE(i.n, 0)
FROM (SELECT "group_id", COUNT(*)::int AS n FROM "error_group_identities" GROUP BY 1) i
WHERE i."group_id" = g."id";