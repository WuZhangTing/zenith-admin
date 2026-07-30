import { defineRouteDomain } from '../_kit';
import announcementsRoutes from './announcements';
import channelsRoutes from './channels';
import emailConfigRoutes from './email-config';
import emailSendLogsRoutes from './email-send-logs';
import emailTemplatesRoutes from './email-templates';
import inAppMessagesRoutes from './in-app-messages';
import inAppTemplatesRoutes from './in-app-templates';
import smsConfigsRoutes from './sms-configs';
import smsSendLogsRoutes from './sms-send-logs';
import smsTemplatesRoutes from './sms-templates';

export default defineRouteDomain({
  name: 'messaging',
  mounts: () => [
    ['/api/announcements', announcementsRoutes],
    ['/api/email-config', emailConfigRoutes],
    ['/api/channels', channelsRoutes],
    ['/api/email-templates', emailTemplatesRoutes],
    ['/api/email-send-logs', emailSendLogsRoutes],
    ['/api/sms-configs', smsConfigsRoutes],
    ['/api/sms-templates', smsTemplatesRoutes],
    ['/api/sms-send-logs', smsSendLogsRoutes],
    ['/api/in-app-templates', inAppTemplatesRoutes],
    ['/api/in-app-messages', inAppMessagesRoutes],
  ],
});
