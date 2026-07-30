import { SEED_EMAIL_TEMPLATES } from '@zenith/shared/seed';
import type { EmailTemplate } from '@zenith/shared/messaging';

export const mockEmailTemplates: EmailTemplate[] = [...SEED_EMAIL_TEMPLATES];

let nextId = Math.max(...mockEmailTemplates.map((t) => t.id)) + 1;
export function getNextEmailTemplateId() {
  return nextId++;
}
