-- ── 工作流运行数据重置（本次修复不保留历史运行数据的兼容性）────────────────────────
-- 1) 复位业务侧引用：biz_leaves.workflow_instance_id 为纯 int 列（无 FK），必须先手动置空，
--    避免删除实例后留下悬空引用；report_fill_records 的 FK 为 on delete set null，无需手动处理
UPDATE "biz_leaves" SET "workflow_instance_id" = NULL, "workflow_status" = NULL, "status" = 'draft' WHERE "workflow_instance_id" IS NOT NULL;--> statement-breakpoint
-- 2) 清空运行账本：作业（含无实例归属的事件派发历史）与实例（级联清空任务/token/评论/催办/协办/补偿/迁移记录）
DELETE FROM "workflow_jobs";--> statement-breakpoint
DELETE FROM "workflow_instances";--> statement-breakpoint
-- 3) 修正内置付款模板描述与实际节点（直属主管 + 部门负责人）一致；种子对已存在模板不回写
UPDATE "workflow_templates" SET "description" = '对外付款申请，直属主管 + 部门负责人两级审批。' WHERE "code" = 'tpl_payment';--> statement-breakpoint
-- ── 结构收紧：activation_id 全量必填 + 活动任务 / 活动 token 部分唯一索引 ─────────────
ALTER TABLE "workflow_tasks" ALTER COLUMN "activation_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wf_tasks_active_uniq" ON "workflow_tasks" USING btree ("instance_id","node_key","activation_id","assignee_id") WHERE "workflow_tasks"."status" in ('pending', 'waiting') and "workflow_tasks"."assignee_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "wf_tokens_active_uniq" ON "workflow_tokens" USING btree ("instance_id","node_key","branch_path") WHERE "workflow_tokens"."status" = 'active';