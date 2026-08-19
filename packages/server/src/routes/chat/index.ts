import { defineRouteDomain } from '../_kit';
import chatBotsRoutes from './chat-bots';
import chatPublicRoutes from './chat-public';
import chatRoutes from './chat';

export default defineRouteDomain({
  name: 'chat',
  mounts: () => [
    ['/api/public/chat/webhook', chatPublicRoutes],
    ['/api/chat', chatRoutes, { feature: 'chat' }],
    ['/api/chat-bots', chatBotsRoutes, { feature: 'chat' }],
  ],
});
