import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type {
  CreatePaymentFundReservationInput,
  CreatePaymentLedgerAccountInput,
  PaymentActiveReservationAmount,
  PaymentFundReservation,
  PaymentFundReservationStatus,
  PaymentJournal,
  PaymentLedgerAccount,
  PostPaymentJournalInput,
} from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface PaymentLedgerAccountListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  appId?: number;
  channelConfigId?: number;
  currency?: string;
  status?: 'enabled' | 'disabled';
}

export interface PaymentJournalListParams {
  page: number;
  pageSize: number;
  sourceType?: string;
  appId?: number;
  channelConfigId?: number;
  currency?: string;
  startTime?: string;
  endTime?: string;
}

export interface PaymentFundReservationListParams {
  page: number;
  pageSize: number;
  accountId?: number;
  status?: PaymentFundReservationStatus;
  sourceType?: string;
  startTime?: string;
  endTime?: string;
}

export const paymentLedgerAccountKeys = {
  all: ['payment-ledger-accounts'] as const,
  lists: ['payment-ledger-accounts', 'list'] as const,
  list: (params: PaymentLedgerAccountListParams) => ['payment-ledger-accounts', 'list', params] as const,
  activeReservation: (accountId: number | undefined) => ['payment-ledger-accounts', 'active-reservation', accountId] as const,
};

export const paymentJournalKeys = {
  all: ['payment-journals'] as const,
  lists: ['payment-journals', 'list'] as const,
  list: (params: PaymentJournalListParams) => ['payment-journals', 'list', params] as const,
  detail: (id: number | undefined) => ['payment-journals', 'detail', id] as const,
};

export const paymentFundReservationKeys = {
  all: ['payment-fund-reservations'] as const,
  lists: ['payment-fund-reservations', 'list'] as const,
  list: (params: PaymentFundReservationListParams) => ['payment-fund-reservations', 'list', params] as const,
};

export function usePaymentLedgerAccountList(params: PaymentLedgerAccountListParams, enabled = true) {
  return useQuery({
    queryKey: paymentLedgerAccountKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<PaymentLedgerAccount>>(`/api/payment/journals/accounts${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreatePaymentLedgerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreatePaymentLedgerAccountInput) =>
      request.post<PaymentLedgerAccount>('/api/payment/journals/accounts', values).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentLedgerAccountKeys.lists }),
  });
}

export function usePaymentActiveReservationAmount(accountId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: paymentLedgerAccountKeys.activeReservation(accountId),
    queryFn: () => request.get<PaymentActiveReservationAmount>(`/api/payment/journals/accounts/${accountId}/active-reservation`).then(unwrap),
    enabled: enabled && accountId !== undefined,
  });
}

export function usePaymentJournalList(params: PaymentJournalListParams, enabled = true) {
  return useQuery({
    queryKey: paymentJournalKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<PaymentJournal>>(`/api/payment/journals${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePaymentJournalDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: paymentJournalKeys.detail(id),
    queryFn: () => request.get<PaymentJournal>(`/api/payment/journals/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function usePostPaymentJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: PostPaymentJournalInput) => request.post<PaymentJournal>('/api/payment/journals', values).then(unwrap),
    onSuccess: (journal) => {
      queryClient.setQueryData(paymentJournalKeys.detail(journal.id), journal);
      return queryClient.invalidateQueries({ queryKey: paymentJournalKeys.lists });
    },
  });
}

export function useReversePaymentJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      request.post<PaymentJournal>(`/api/payment/journals/${id}/reverse`, { reason }).then(unwrap),
    onSuccess: (journal) => {
      queryClient.setQueryData(paymentJournalKeys.detail(journal.id), journal);
      return queryClient.invalidateQueries({ queryKey: paymentJournalKeys.lists });
    },
  });
}

export function usePaymentFundReservationList(params: PaymentFundReservationListParams, enabled = true) {
  return useQuery({
    queryKey: paymentFundReservationKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<PaymentFundReservation>>(`/api/payment/journals/reservations${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreatePaymentFundReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreatePaymentFundReservationInput) =>
      request.post<PaymentFundReservation>('/api/payment/journals/reservations', values).then(unwrap),
    onSuccess: (_reservation, values) => {
      void queryClient.invalidateQueries({ queryKey: paymentFundReservationKeys.lists });
      void queryClient.invalidateQueries({ queryKey: paymentLedgerAccountKeys.activeReservation(values.accountId) });
    },
  });
}

export function useTransitionPaymentFundReservation(action: 'capture' | 'release') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId: _accountId, version, reason }: { id: number; accountId: number; version: number; reason: string }) =>
      request.post<PaymentFundReservation>(`/api/payment/journals/reservations/${id}/${action}`, { version, reason }).then(unwrap),
    onSuccess: (_reservation, values) => {
      void queryClient.invalidateQueries({ queryKey: paymentFundReservationKeys.lists });
      void queryClient.invalidateQueries({ queryKey: paymentLedgerAccountKeys.activeReservation(values.accountId) });
    },
  });
}
