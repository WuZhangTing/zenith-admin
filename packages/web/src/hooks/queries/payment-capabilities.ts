import { useQuery } from '@tanstack/react-query';
import type { PaymentChannel, PaymentMethod } from '@zenith/shared/payment';
import { toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';

export interface PaymentCapabilityParams {
  channelConfigId?: number;
  channel?: PaymentChannel;
  operation?: string;
  method?: PaymentMethod;
  currency?: string;
}

export interface PaymentEffectiveCapability {
  operation: string;
  environment: 'sandbox' | 'live';
  paymentMethod: PaymentMethod | null;
  currency: string;
  supported: boolean;
  reason: string | null;
}

export interface PaymentConfigCapabilities {
  channelConfigId: number;
  channel: PaymentChannel;
  environment: 'sandbox' | 'live';
  configStatus: 'enabled' | 'disabled';
  supported: boolean;
  reason: string | null;
  capabilities: PaymentEffectiveCapability[];
}

export interface PaymentCapabilitiesResponse {
  engineMode: 'off' | 'sandbox' | 'live';
  configs: PaymentConfigCapabilities[];
}

export const paymentCapabilityKeys = {
  all: ['payment-capabilities'] as const,
  list: (params: PaymentCapabilityParams) => ['payment-capabilities', params] as const,
};

export function usePaymentCapabilities(params: PaymentCapabilityParams, enabled = true) {
  return useQuery({
    queryKey: paymentCapabilityKeys.list(params),
    queryFn: () => request
      .get<PaymentCapabilitiesResponse>(`/api/payment/capabilities${toQueryString(params)}`)
      .then(unwrap),
    enabled,
    staleTime: 60_000,
  });
}
