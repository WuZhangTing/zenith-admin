import { SEED_SMS_TEMPLATES } from '@zenith/shared/seed';
import type { SmsTemplate } from '@zenith/shared/messaging';

export const mockSmsTemplates: SmsTemplate[] = [...SEED_SMS_TEMPLATES];

let nextId = Math.max(...mockSmsTemplates.map((t) => t.id)) + 1;
export function getNextSmsTemplateId() {
  return nextId++;
}
