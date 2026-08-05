import type { NodeSDK } from '@opentelemetry/sdk-node';
import { config } from '../config';
import logger from './logger';

let telemetrySdk: NodeSDK | null = null;
let telemetryInitialized = false;

export const initTelemetry = async (): Promise<boolean> => {
  if (!config.otel.enabled) {
    return false;
  }

  if (telemetryInitialized) {
    return true;
  }

  try {
    // 惰性加载：@opentelemetry/sdk-node 模块图很大（实测数秒），仅在启用 OTel 时才引入
    const [{ NodeSDK }, { OTLPTraceExporter }] = await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/exporter-trace-otlp-http'),
    ]);
    telemetrySdk = new NodeSDK({
      serviceName: config.otel.serviceName,
      traceExporter: new OTLPTraceExporter(),
    });
    telemetrySdk.start();
    telemetryInitialized = true;

    logger.info('OpenTelemetry tracing enabled', {
      serviceName: config.otel.serviceName,
      serviceVersion: config.otel.serviceVersion,
    });

    return true;
  } catch (error) {
    telemetrySdk = null;
    telemetryInitialized = false;
    logger.error('Failed to initialize OpenTelemetry tracing', error);
    return false;
  }
};

export const shutdownTelemetry = async (): Promise<void> => {
  if (!telemetrySdk || !telemetryInitialized) {
    return;
  }

  try {
    await telemetrySdk.shutdown();
  } catch (error) {
    logger.error('Failed to shutdown OpenTelemetry tracing', error);
  } finally {
    telemetrySdk = null;
    telemetryInitialized = false;
  }
};
