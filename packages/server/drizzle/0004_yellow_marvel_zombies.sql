-- 破坏式支付域重建：不保留旧交易/账务历史，先清空所有依赖旧契约的数据，
-- 再执行非空应用、商户配置、幂等键与总账字段变更。身份与权限表不在清理范围内。
TRUNCATE TABLE
  payment_notify_logs,
  payment_refunds,
  payment_orders,
  payment_contracts,
  payment_preauths,
  payment_recon_items,
  payment_recon_batches,
  payment_settlement_batches,
  payment_sharing_orders,
  payment_sharing_receivers,
  payment_transfers,
  payment_risk_hits,
  payment_risk_reviews,
  payment_risk_rules,
  payment_links,
  payment_method_configs,
  payment_deduct_plans,
  payment_events,
  payment_channel_configs,
  payment_apps,
  member_wallet_transactions
  CASCADE;--> statement-breakpoint
-- 清理已移除的支付专用 Webhook 菜单及其授权，避免 seed upsert 把死入口重新暴露。
DELETE FROM user_menus WHERE menu_id BETWEEN 8070 AND 8074;--> statement-breakpoint
DELETE FROM role_menus WHERE menu_id BETWEEN 8070 AND 8074;--> statement-breakpoint
DELETE FROM menus WHERE id BETWEEN 8070 AND 8074;--> statement-breakpoint
CREATE TYPE "public"."payment_cashier_session_status" AS ENUM('ready', 'creating', 'awaiting', 'processing', 'unknown', 'succeeded', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_cashier_use_slot_status" AS ENUM('none', 'reserved', 'consumed', 'released');--> statement-breakpoint
CREATE TYPE "public"."payment_contract_operation" AS ENUM('sign', 'terminate');--> statement-breakpoint
CREATE TYPE "public"."payment_fund_reservation_status" AS ENUM('active', 'captured', 'released', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_ledger_account_code" AS ENUM('provider_clearing', 'merchant_pending', 'merchant_available', 'merchant_frozen', 'platform_fee', 'refund_payable', 'sharing_payable', 'payout_payable', 'suspense');--> statement-breakpoint
CREATE TYPE "public"."payment_ledger_normal_balance" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."payment_preauth_operation" AS ENUM('freeze', 'capture', 'release');--> statement-breakpoint
CREATE TYPE "public"."payment_sharing_reversal_status" AS ENUM('processing', 'unknown', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_transfer_approval_status" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."payment_contract_status" ADD VALUE 'unknown' BEFORE 'signed';--> statement-breakpoint
ALTER TYPE "public"."payment_contract_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."payment_order_status" ADD VALUE 'unknown' BEFORE 'success';--> statement-breakpoint
ALTER TYPE "public"."payment_preauth_status" ADD VALUE 'unknown' BEFORE 'frozen';--> statement-breakpoint
ALTER TYPE "public"."payment_refund_status" ADD VALUE 'unknown' BEFORE 'success';--> statement-breakpoint
ALTER TYPE "public"."payment_sharing_order_status" ADD VALUE 'reversed';--> statement-breakpoint
ALTER TYPE "public"."payment_transfer_status" ADD VALUE 'unknown' BEFORE 'success';--> statement-breakpoint
CREATE TABLE "payment_cashier_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_cashier_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_token" varchar(64) NOT NULL,
	"link_id" integer NOT NULL,
	"app_id" integer NOT NULL,
	"order_no" varchar(64),
	"pay_method" "payment_method" NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_cashier_session_status" DEFAULT 'ready' NOT NULL,
	"use_slot_status" "payment_cashier_use_slot_status" DEFAULT 'none' NOT NULL,
	"pay_params" jsonb,
	"return_url" varchar(512) NOT NULL,
	"error_message" varchar(512),
	"expires_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_cashier_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "payment_fund_reservations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_fund_reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reservation_no" varchar(64) NOT NULL,
	"account_id" integer NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" varchar(128) NOT NULL,
	"amount" bigint NOT NULL,
	"status" "payment_fund_reservation_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"reason" varchar(256),
	"finalization_reason" varchar(256),
	"app_id" integer NOT NULL,
	"channel_config_id" integer NOT NULL,
	"currency" varchar(8) NOT NULL,
	"tenant_id" integer,
	"expires_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_fund_reservations_reservation_no_unique" UNIQUE("reservation_no"),
	CONSTRAINT "payment_fund_reservations_amount_positive_check" CHECK ("payment_fund_reservations"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_journal_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_journal_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"journal_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" integer NOT NULL,
	"debit_amount" bigint DEFAULT 0 NOT NULL,
	"credit_amount" bigint DEFAULT 0 NOT NULL,
	"memo" varchar(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_journal_lines_journal_line_unique" UNIQUE("journal_id","line_no"),
	CONSTRAINT "payment_journal_lines_single_side_check" CHECK ((("payment_journal_lines"."debit_amount" > 0 and "payment_journal_lines"."credit_amount" = 0) or ("payment_journal_lines"."credit_amount" > 0 and "payment_journal_lines"."debit_amount" = 0)))
);
--> statement-breakpoint
CREATE TABLE "payment_journals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_journals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"journal_no" varchar(64) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"description" varchar(512) NOT NULL,
	"app_id" integer NOT NULL,
	"channel_config_id" integer NOT NULL,
	"currency" varchar(8) NOT NULL,
	"reversal_of_journal_id" integer,
	"operator_id" integer,
	"tenant_id" integer,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_journals_journal_no_unique" UNIQUE("journal_no")
);
--> statement-breakpoint
CREATE TABLE "payment_ledger_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_ledger_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"account_no" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"code" "payment_ledger_account_code" NOT NULL,
	"normal_balance" "payment_ledger_normal_balance" NOT NULL,
	"app_id" integer NOT NULL,
	"channel_config_id" integer NOT NULL,
	"currency" varchar(8) NOT NULL,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_ledger_accounts_account_no_unique" UNIQUE("account_no")
);
--> statement-breakpoint
CREATE TABLE "payment_link_redemptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_link_redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"link_id" integer NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"tenant_id" integer,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_link_redemptions_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "payment_settlement_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_settlement_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"batch_id" integer NOT NULL,
	"journal_line_id" integer NOT NULL,
	"amount" bigint NOT NULL,
	"app_id" integer NOT NULL,
	"channel_config_id" integer NOT NULL,
	"currency" varchar(8) NOT NULL,
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_settlement_items_journal_line_unique" UNIQUE("journal_line_id"),
	CONSTRAINT "payment_settlement_items_batch_line_unique" UNIQUE("batch_id","journal_line_id"),
	CONSTRAINT "payment_settlement_items_amount_nonzero_check" CHECK ("payment_settlement_items"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "payment_sharing_reversals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_sharing_reversals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reversal_no" varchar(64) NOT NULL,
	"sharing_order_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_sharing_reversal_status" DEFAULT 'processing' NOT NULL,
	"channel_reversal_no" varchar(128),
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"reason" varchar(256) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"query_attempts" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"error_message" varchar(512),
	"finished_at" timestamp with time zone,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_sharing_reversals_reversal_no_unique" UNIQUE("reversal_no"),
	CONSTRAINT "payment_sharing_reversals_sharing_order_unique" UNIQUE("sharing_order_id")
);
--> statement-breakpoint
ALTER TABLE "payment_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_ledger_entries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_report_daily" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_webhook_deliveries" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_webhook_endpoints" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "payment_accounts" CASCADE;--> statement-breakpoint
DROP TABLE "payment_ledger_entries" CASCADE;--> statement-breakpoint
DROP TABLE "payment_report_daily" CASCADE;--> statement-breakpoint
DROP TABLE "payment_webhook_deliveries" CASCADE;--> statement-breakpoint
DROP TABLE "payment_webhook_endpoints" CASCADE;--> statement-breakpoint
ALTER TABLE "payment_apps" DROP CONSTRAINT "payment_apps_app_key_unique";--> statement-breakpoint
ALTER TABLE "payment_method_configs" DROP CONSTRAINT "payment_method_configs_method_unique";--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_channel_out_trade_no_uq";--> statement-breakpoint
ALTER TABLE "payment_transfers" DROP CONSTRAINT "payment_transfers_channel_out_no_uq";--> statement-breakpoint
ALTER TABLE "payment_contracts" DROP CONSTRAINT "payment_contracts_channel_config_id_payment_channel_configs_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_channel_config_id_payment_channel_configs_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_app_id_payment_apps_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_preauths" DROP CONSTRAINT "payment_preauths_channel_config_id_payment_channel_configs_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_refunds" DROP CONSTRAINT "payment_refunds_order_id_payment_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_sharing_orders" DROP CONSTRAINT "payment_sharing_orders_receiver_id_payment_sharing_receivers_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_transfers" DROP CONSTRAINT "payment_transfers_channel_config_id_payment_channel_configs_id_fk";
--> statement-breakpoint
ALTER TABLE "member_wallet_transactions" DROP CONSTRAINT "member_wallet_transactions_payment_order_id_payment_orders_id_fk";
--> statement-breakpoint
DROP INDEX "payment_risk_reviews_pending_order_uq";--> statement-breakpoint
DROP INDEX "app_webhook_deliveries_client_idx";--> statement-breakpoint
DROP INDEX "app_webhook_subscriptions_client_idx";--> statement-breakpoint
DROP INDEX "payment_contracts_active_biz_uq";--> statement-breakpoint
DROP INDEX "payment_contracts_biz_idx";--> statement-breakpoint
DROP INDEX "payment_orders_active_biz_uq";--> statement-breakpoint
DROP INDEX "payment_orders_biz_idx";--> statement-breakpoint
DROP INDEX "payment_preauths_active_biz_uq";--> statement-breakpoint
DROP INDEX "payment_preauths_biz_idx";--> statement-breakpoint
DROP INDEX "payment_settlement_period_uq";--> statement-breakpoint
DROP INDEX "payment_settlement_period_global_uq";--> statement-breakpoint
ALTER TABLE "payment_contracts" ALTER COLUMN "channel_config_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_orders" ALTER COLUMN "channel_config_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_orders" ALTER COLUMN "app_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_preauths" ALTER COLUMN "channel_config_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_refunds" ALTER COLUMN "order_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ALTER COLUMN "channel_config_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_webhook_deliveries" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_apps" ADD COLUMN "open_client_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_channel_configs" ADD COLUMN "callback_token" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_channel_configs" ADD COLUMN "sandbox_notify_secret_encrypted" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_channel_configs" ADD COLUMN "alipay_seller_id" varchar(64);--> statement-breakpoint
ALTER TABLE "payment_contracts" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_contracts" ADD COLUMN "currency" varchar(8) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_contracts" ADD COLUMN "unknown_operation" "payment_contract_operation";--> statement-breakpoint
ALTER TABLE "payment_contracts" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_contracts" ADD COLUMN "error_message" varchar(512);--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_links" ADD COLUMN "reserved_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD COLUMN "channel_config_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD COLUMN "app_id" integer;--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD COLUMN "provider_event_id" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD COLUMN "merchant_id" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD COLUMN "provider_app_id" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD COLUMN "paid_amount" integer;--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD COLUMN "currency" varchar(8);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "return_url" varchar(512);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "idempotency_key" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "request_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_preauths" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_preauths" ADD COLUMN "currency" varchar(8) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_preauths" ADD COLUMN "unknown_operation" "payment_preauth_operation";--> statement-breakpoint
ALTER TABLE "payment_preauths" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ADD COLUMN "channel_config_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ADD COLUMN "currency" varchar(8) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD COLUMN "idempotency_key" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD COLUMN "request_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_risk_reviews" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_risk_reviews" ADD COLUMN "currency" varchar(8) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD COLUMN "channel_config_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD COLUMN "currency" varchar(8) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD COLUMN "failure_reason" varchar(512);--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD COLUMN "payout_reference" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_sharing_orders" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "app_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "currency" varchar(8) DEFAULT 'CNY' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "approval_status" "payment_transfer_approval_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "applied_by_id" integer;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "approver_id" integer;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "approval_remark" varchar(256);--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "idempotency_key" varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "request_hash" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "fund_reservation_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_webhook_deliveries" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "oauth2_clients" ADD COLUMN "tenant_id" integer;--> statement-breakpoint
ALTER TABLE "member_wallet_transactions" ADD COLUMN "payment_intent_no" varchar(64);--> statement-breakpoint
ALTER TABLE "member_wallet_transactions" ADD COLUMN "payment_event_id" varchar(128);--> statement-breakpoint
ALTER TABLE "payment_cashier_sessions" ADD CONSTRAINT "payment_cashier_sessions_link_id_payment_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_cashier_sessions" ADD CONSTRAINT "payment_cashier_sessions_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_cashier_sessions" ADD CONSTRAINT "payment_cashier_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fund_reservations" ADD CONSTRAINT "payment_fund_reservations_account_id_payment_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."payment_ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fund_reservations" ADD CONSTRAINT "payment_fund_reservations_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fund_reservations" ADD CONSTRAINT "payment_fund_reservations_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fund_reservations" ADD CONSTRAINT "payment_fund_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fund_reservations" ADD CONSTRAINT "payment_fund_reservations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fund_reservations" ADD CONSTRAINT "payment_fund_reservations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_journal_lines" ADD CONSTRAINT "payment_journal_lines_journal_id_payment_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."payment_journals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_journal_lines" ADD CONSTRAINT "payment_journal_lines_account_id_payment_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."payment_ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_journals" ADD CONSTRAINT "payment_journals_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_journals" ADD CONSTRAINT "payment_journals_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_journals" ADD CONSTRAINT "payment_journals_reversal_of_journal_id_payment_journals_id_fk" FOREIGN KEY ("reversal_of_journal_id") REFERENCES "public"."payment_journals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_journals" ADD CONSTRAINT "payment_journals_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_journals" ADD CONSTRAINT "payment_journals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger_accounts" ADD CONSTRAINT "payment_ledger_accounts_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger_accounts" ADD CONSTRAINT "payment_ledger_accounts_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger_accounts" ADD CONSTRAINT "payment_ledger_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger_accounts" ADD CONSTRAINT "payment_ledger_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger_accounts" ADD CONSTRAINT "payment_ledger_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_link_redemptions" ADD CONSTRAINT "payment_link_redemptions_link_id_payment_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."payment_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_link_redemptions" ADD CONSTRAINT "payment_link_redemptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlement_items" ADD CONSTRAINT "payment_settlement_items_batch_id_payment_settlement_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payment_settlement_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlement_items" ADD CONSTRAINT "payment_settlement_items_journal_line_id_payment_journal_lines_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."payment_journal_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlement_items" ADD CONSTRAINT "payment_settlement_items_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlement_items" ADD CONSTRAINT "payment_settlement_items_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlement_items" ADD CONSTRAINT "payment_settlement_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sharing_reversals" ADD CONSTRAINT "payment_sharing_reversals_sharing_order_id_payment_sharing_orders_id_fk" FOREIGN KEY ("sharing_order_id") REFERENCES "public"."payment_sharing_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sharing_reversals" ADD CONSTRAINT "payment_sharing_reversals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sharing_reversals" ADD CONSTRAINT "payment_sharing_reversals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sharing_reversals" ADD CONSTRAINT "payment_sharing_reversals_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_cashier_sessions_order_no_unique" ON "payment_cashier_sessions" USING btree ("order_no") WHERE "payment_cashier_sessions"."order_no" is not null;--> statement-breakpoint
CREATE INDEX "payment_cashier_sessions_link_idx" ON "payment_cashier_sessions" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "payment_cashier_sessions_link_slot_idx" ON "payment_cashier_sessions" USING btree ("link_id","use_slot_status","expires_at");--> statement-breakpoint
CREATE INDEX "payment_cashier_sessions_status_expiry_idx" ON "payment_cashier_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "payment_cashier_sessions_tenant_idx" ON "payment_cashier_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_fund_reservations_source_scope_uq" ON "payment_fund_reservations" USING btree (coalesce("tenant_id", 0),"app_id","channel_config_id","currency","source_type","source_id");--> statement-breakpoint
CREATE INDEX "payment_fund_reservations_active_account_idx" ON "payment_fund_reservations" USING btree ("account_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "payment_fund_reservations_scope_idx" ON "payment_fund_reservations" USING btree ("tenant_id","app_id","channel_config_id","currency");--> statement-breakpoint
CREATE INDEX "payment_journal_lines_account_idx" ON "payment_journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_journals_source_scope_uq" ON "payment_journals" USING btree (coalesce("tenant_id", 0),"app_id","channel_config_id","currency","source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_journals_reversal_once_uq" ON "payment_journals" USING btree ("reversal_of_journal_id") WHERE "payment_journals"."reversal_of_journal_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_journals_scope_posted_idx" ON "payment_journals" USING btree ("tenant_id","app_id","channel_config_id","currency","posted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_ledger_accounts_scope_code_uq" ON "payment_ledger_accounts" USING btree (coalesce("tenant_id", 0),"app_id","channel_config_id","currency","code");--> statement-breakpoint
CREATE INDEX "payment_ledger_accounts_scope_idx" ON "payment_ledger_accounts" USING btree ("tenant_id","app_id","channel_config_id","currency");--> statement-breakpoint
CREATE INDEX "payment_link_redemptions_link_idx" ON "payment_link_redemptions" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "payment_link_redemptions_tenant_idx" ON "payment_link_redemptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_settlement_items_batch_idx" ON "payment_settlement_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "payment_settlement_items_scope_idx" ON "payment_settlement_items" USING btree ("tenant_id","app_id","channel_config_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_sharing_reversals_idempotency_scope_uq" ON "payment_sharing_reversals" USING btree (coalesce("tenant_id", 0),"sharing_order_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_sharing_reversals_tenant_status_idx" ON "payment_sharing_reversals" USING btree ("tenant_id","status");--> statement-breakpoint
ALTER TABLE "payment_apps" ADD CONSTRAINT "payment_apps_open_client_id_oauth2_clients_id_fk" FOREIGN KEY ("open_client_id") REFERENCES "public"."oauth2_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_contracts" ADD CONSTRAINT "payment_contracts_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_contracts" ADD CONSTRAINT "payment_contracts_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD CONSTRAINT "payment_notify_logs_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_notify_logs" ADD CONSTRAINT "payment_notify_logs_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_preauths" ADD CONSTRAINT "payment_preauths_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_preauths" ADD CONSTRAINT "payment_preauths_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ADD CONSTRAINT "payment_recon_batches_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_recon_batches" ADD CONSTRAINT "payment_recon_batches_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_risk_reviews" ADD CONSTRAINT "payment_risk_reviews_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD CONSTRAINT "payment_settlement_batches_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlement_batches" ADD CONSTRAINT "payment_settlement_batches_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_sharing_orders" ADD CONSTRAINT "payment_sharing_orders_receiver_id_payment_sharing_receivers_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."payment_sharing_receivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_app_id_payment_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."payment_apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_applied_by_id_users_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_fund_reservation_id_payment_fund_reservations_id_fk" FOREIGN KEY ("fund_reservation_id") REFERENCES "public"."payment_fund_reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_channel_config_id_payment_channel_configs_id_fk" FOREIGN KEY ("channel_config_id") REFERENCES "public"."payment_channel_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_webhook_deliveries" ADD CONSTRAINT "app_webhook_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD CONSTRAINT "app_webhook_subscriptions_client_id_oauth2_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth2_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD CONSTRAINT "app_webhook_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth2_authorization_codes" ADD CONSTRAINT "oauth2_authorization_codes_client_id_oauth2_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth2_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth2_clients" ADD CONSTRAINT "oauth2_clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_channel_configs_default_tenant_channel_uq" ON "payment_channel_configs" USING btree ("tenant_id","channel") WHERE "payment_channel_configs"."is_default" = true and "payment_channel_configs"."tenant_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_channel_configs_default_global_channel_uq" ON "payment_channel_configs" USING btree ("channel") WHERE "payment_channel_configs"."is_default" = true and "payment_channel_configs"."tenant_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_contracts_member_renewal_active_uq" ON "payment_contracts" USING btree (coalesce("tenant_id", 0),"biz_type","biz_id","currency") WHERE "payment_contracts"."biz_type" = 'member_renewal' and "payment_contracts"."status" in ('pending', 'signed', 'paused');--> statement-breakpoint
CREATE INDEX "payment_links_app_idx" ON "payment_links" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_method_configs_tenant_method_uq" ON "payment_method_configs" USING btree (coalesce("tenant_id", 0),"method");--> statement-breakpoint
CREATE INDEX "payment_notify_logs_config_idx" ON "payment_notify_logs" USING btree ("channel_config_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_notify_logs_provider_event_uq" ON "payment_notify_logs" USING btree ("channel_config_id","provider_event_id") WHERE "payment_notify_logs"."provider_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_idempotency_scope_uq" ON "payment_orders" USING btree (coalesce("tenant_id", 0),coalesce("app_id", 0),"idempotency_key") WHERE "payment_orders"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "payment_recon_batches_app_idx" ON "payment_recon_batches" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_recon_scope_date_uq" ON "payment_recon_batches" USING btree (coalesce("tenant_id", 0),"app_id","channel_config_id","currency","bill_date");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_refunds_idempotency_scope_uq" ON "payment_refunds" USING btree (coalesce("tenant_id", 0),"order_id","idempotency_key") WHERE "payment_refunds"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_risk_reviews_pending_biz_scope_uq" ON "payment_risk_reviews" USING btree (coalesce("tenant_id", 0),coalesce("app_id", 0),"biz_type","biz_id","currency") WHERE "payment_risk_reviews"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "payment_risk_reviews_order_no_idx" ON "payment_risk_reviews" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "payment_settlement_batches_app_idx" ON "payment_settlement_batches" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transfers_idempotency_scope_uq" ON "payment_transfers" USING btree (coalesce("tenant_id", 0),"app_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "app_webhook_deliveries_tenant_client_idx" ON "app_webhook_deliveries" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "app_webhook_subscriptions_tenant_client_idx" ON "app_webhook_subscriptions" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "oauth2_clients_tenant_idx" ON "oauth2_clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_wallet_tx_payment_event_uq" ON "member_wallet_transactions" USING btree ("payment_event_id") WHERE "member_wallet_transactions"."payment_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_contracts_active_biz_uq" ON "payment_contracts" USING btree (coalesce("tenant_id", 0),"app_id","biz_type","biz_id","currency") WHERE "payment_contracts"."status" in ('pending', 'signed', 'paused');--> statement-breakpoint
CREATE INDEX "payment_contracts_biz_idx" ON "payment_contracts" USING btree ("tenant_id","app_id","biz_type","biz_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_active_biz_uq" ON "payment_orders" USING btree (coalesce("tenant_id", 0),coalesce("app_id", 0),"biz_type","biz_id","currency") WHERE "payment_orders"."status" in ('pending', 'paying');--> statement-breakpoint
CREATE INDEX "payment_orders_biz_idx" ON "payment_orders" USING btree ("tenant_id","app_id","biz_type","biz_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_preauths_active_biz_uq" ON "payment_preauths" USING btree (coalesce("tenant_id", 0),"app_id","biz_type","biz_id","currency") WHERE "payment_preauths"."status" in ('pending', 'frozen');--> statement-breakpoint
CREATE INDEX "payment_preauths_biz_idx" ON "payment_preauths" USING btree ("tenant_id","app_id","biz_type","biz_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_settlement_period_uq" ON "payment_settlement_batches" USING btree ("app_id","channel_config_id","currency","period_start","period_end","tenant_id") WHERE "payment_settlement_batches"."tenant_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_settlement_period_global_uq" ON "payment_settlement_batches" USING btree ("app_id","channel_config_id","currency","period_start","period_end") WHERE "payment_settlement_batches"."tenant_id" is null;--> statement-breakpoint
ALTER TABLE "payment_apps" DROP COLUMN "app_key";--> statement-breakpoint
ALTER TABLE "member_wallet_transactions" DROP COLUMN "payment_order_id";--> statement-breakpoint
ALTER TABLE "payment_apps" ADD CONSTRAINT "payment_apps_open_client_unique" UNIQUE("open_client_id");--> statement-breakpoint
ALTER TABLE "payment_channel_configs" ADD CONSTRAINT "payment_channel_configs_callback_token_unique" UNIQUE("callback_token");--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_config_out_trade_no_uq" UNIQUE("channel_config_id","out_trade_no");--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_config_out_no_uq" UNIQUE("channel_config_id","out_transfer_no");--> statement-breakpoint
ALTER TABLE "app_webhook_subscriptions" ADD CONSTRAINT "app_webhook_subscriptions_identity_check" CHECK ((("app_webhook_subscriptions"."internal" = true and "app_webhook_subscriptions"."client_id" is null) or ("app_webhook_subscriptions"."internal" = false and "app_webhook_subscriptions"."client_id" is not null)));--> statement-breakpoint
DROP TYPE "public"."payment_ledger_direction";--> statement-breakpoint
DROP TYPE "public"."payment_ledger_type";--> statement-breakpoint
DROP TYPE "public"."payment_webhook_delivery_status";
