import { SEED_INAPP_TEMPLATES } from '@zenith/shared/seed';
import type { InAppTemplate } from '@zenith/shared/messaging';

export const mockInAppTemplates: InAppTemplate[] = [...SEED_INAPP_TEMPLATES];

let nextId = Math.max(...mockInAppTemplates.map((t) => t.id)) + 1;
export function getNextInAppTemplateId() {
  return nextId++;
}
