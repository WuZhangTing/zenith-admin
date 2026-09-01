import { z } from '@hono/zod-openapi';
import { PAYMENT_FUND_RESERVATION_STATUSES, PAYMENT_LEDGER_ACCOUNT_CODES, PAYMENT_LEDGER_NORMAL_BALANCES } from '@zenith/shared/payment';

const amountString = z.string().regex(/^\d+$/).openapi({ description: '最小货币单位的十进制字符串', example: '10000' });

export const PaymentLedgerAccountDTO = z.object({
  id: z.number().int(),
  accountNo: z.string(),
  name: z.string(),
  code: z.enum(PAYMENT_LEDGER_ACCOUNT_CODES),
  normalBalance: z.enum(PAYMENT_LEDGER_NORMAL_BALANCES),
  appId: z.number().int(),
  channelConfigId: z.number().int(),
  currency: z.string(),
  status: z.enum(['enabled', 'disabled']),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi('PaymentLedgerAccount');

export const PaymentJournalLineDTO = z.object({
  id: z.number().int(),
  lineNo: z.number().int(),
  accountId: z.number().int(),
  accountNo: z.string(),
  accountName: z.string(),
  debitAmount: amountString,
  creditAmount: amountString,
  memo: z.string().nullable().optional(),
}).openapi('PaymentJournalLine');

export const PaymentJournalDTO = z.object({
  id: z.number().int(),
  journalNo: z.string(),
  sourceType: z.string(),
  sourceId: z.string(),
  description: z.string(),
  appId: z.number().int(),
  channelConfigId: z.number().int(),
  currency: z.string(),
  reversalOfJournalId: z.number().int().nullable().optional(),
  reversedByJournalId: z.number().int().nullable().optional(),
  operatorId: z.number().int().nullable().optional(),
  postedAt: z.string(),
  createdAt: z.string(),
  lines: z.array(PaymentJournalLineDTO),
}).openapi('PaymentJournal');

export const PaymentFundReservationDTO = z.object({
  id: z.number().int(),
  reservationNo: z.string(),
  accountId: z.number().int(),
  sourceType: z.string(),
  sourceId: z.string(),
  amount: amountString,
  status: z.enum(PAYMENT_FUND_RESERVATION_STATUSES),
  version: z.number().int().nonnegative(),
  reason: z.string().nullable().optional(),
  finalizationReason: z.string().nullable().optional(),
  appId: z.number().int(),
  channelConfigId: z.number().int(),
  currency: z.string(),
  expiresAt: z.string().nullable().optional(),
  finalizedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi('PaymentFundReservation');

export const PaymentActiveReservationAmountDTO = z.object({
  accountId: z.number().int(),
  amount: amountString,
}).openapi('PaymentActiveReservationAmount');
