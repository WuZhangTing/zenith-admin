import type {
  AnalyticsEnvironment,
  AnalyticsEventSource,
} from '@zenith/shared/analytics';

export interface AnalyticsRuntimeBaseConfig {
  apiBase: string;
  tokenKey: string;
  source: AnalyticsEventSource;
  appId: string;
  environment: AnalyticsEnvironment;
  consentProvider: () => boolean;
  siteKey?: string;
}
