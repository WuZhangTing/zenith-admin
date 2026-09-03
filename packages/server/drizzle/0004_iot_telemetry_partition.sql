-- 手写 DDL（Drizzle schema 无法表达分区表）：iot_telemetry 重建为按 reported_at 的 RANGE 日分区表。
-- 不迁移历史明细：最新值在设备影子（iot_device_state），长窗口图表与仪表盘读小时聚合表（iot_telemetry_hourly），
-- 明细本身只保留 30 天。Drizzle 快照仍以普通表描述列 / 索引 / 外键（父表定义自动继承到每个分区），
-- 重建迁移基线时必须随基线一并保留本文件（见 docs/backend/database.md「迁移目录」）。
DROP TABLE IF EXISTS "iot_telemetry";--> statement-breakpoint
CREATE TABLE "iot_telemetry" (
	"device_id" integer NOT NULL,
	"metrics" jsonb NOT NULL,
	"reported_at" timestamp DEFAULT now() NOT NULL
) PARTITION BY RANGE ("reported_at");--> statement-breakpoint
ALTER TABLE "iot_telemetry" ADD CONSTRAINT "iot_telemetry_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iot_telemetry_device_time" ON "iot_telemetry" USING btree ("device_id","reported_at");--> statement-breakpoint
CREATE INDEX "idx_iot_telemetry_time_brin" ON "iot_telemetry" USING brin ("reported_at");--> statement-breakpoint
-- 初始分区：UTC 日 [昨天, 今天 + 7]，命名 iot_telemetry_pYYYYMMDD（与 iot-partitions.service 口径一致）。
-- 之后由系统任务「IoT 遥测分区维护」滚动预建，写入命中缺失分区时按需补建，保留策略按分区整表 DROP。
DO $$
DECLARE
  d date;
BEGIN
  FOR d IN
    SELECT generate_series((now() AT TIME ZONE 'UTC')::date - 1, (now() AT TIME ZONE 'UTC')::date + 7, interval '1 day')::date
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF "iot_telemetry" FOR VALUES FROM (%L) TO (%L)',
      'iot_telemetry_p' || to_char(d, 'YYYYMMDD'), d::timestamp, (d + 1)::timestamp
    );
  END LOOP;
END $$;