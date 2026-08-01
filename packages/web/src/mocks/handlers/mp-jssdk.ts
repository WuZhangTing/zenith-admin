import { http } from 'msw';
import { ok } from '@/mocks/utils/handlers';

export const mpJsSdkHandlers = [
  http.post('/api/mp/jssdk/config', async ({ request }) => {
    const body = await request.json() as { accountId: number; url: string };
    return ok({ appId: `wxmockapp${body.accountId}`, timestamp: Math.floor(Date.now() / 1000), nonceStr: Math.random().toString(36).slice(2, 12), signature: Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40) });
  }),
];
