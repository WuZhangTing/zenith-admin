-- 智能体去市场化 + Mastra AgentConfig 形状:数据不向后兼容,清空重建
TRUNCATE TABLE "ai_agents";--> statement-breakpoint
ALTER TABLE "ai_agents" DROP COLUMN "system_prompt";--> statement-breakpoint
ALTER TABLE "ai_agents" DROP COLUMN "temperature";--> statement-breakpoint
ALTER TABLE "ai_agents" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "ai_agents" DROP COLUMN "cloned_from_id";--> statement-breakpoint
DROP TYPE "public"."ai_agent_status";