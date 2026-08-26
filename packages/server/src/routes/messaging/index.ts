import { defineRouteDomain } from '../_kit';
import announcementsRoutes from './announcements';
import channelsRoutes from './channels';
import emailConfigRoutes from './email-config';
import emailSendLogsRoutes from './email-send-logs';
import emailTemplatesRoutes from './email-templates';
import inAppMessagesRoutes from './in-app-messages';
import inAppTemplatesRoutes from './in-app-templates';
import notificationPoliciesRoutes from './notification-policies';
import notificationPreferencesRoutes from './notification-preferences';
import notificationUnsubscribeRoutes from './notification-unsubscribe';
import smsConfigsRoutes from './sms-configs';
import smsSendLogsRoutes from './sms-send-logs';
import smsTemplatesRoutes from './sms-templates';
import pushConfigsRoutes from './push-configs';
import pushSendLogsRoutes from './push-send-logs';

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
    ['/api/push-configs', pushConfigsRoutes],
    ['/api/push-send-logs', pushSendLogsRoutes],
    ['/api/in-app-templates', inAppTemplatesRoutes],
    ['/api/in-app-messages', inAppMessagesRoutes],
    ['/api/notification-preferences', notificationPreferencesRoutes],
    ['/api/notification-policies', notificationPoliciesRoutes],
    ['/api/notification-unsubscribe', notificationUnsubscribeRoutes],
  ],
});
