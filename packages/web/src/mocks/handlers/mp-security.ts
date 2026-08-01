import { http } from 'msw';
import { ok } from '@/mocks/utils/handlers';

const RISKY_WORDS = ['违规', '赌博', '诈骗', '色情', '暴力'];

export const mpSecurityHandlers = [
  http.post('/api/mp/security/check-text', async ({ request }) => {
    const body = await request.json() as { accountId: number; content: string };
    const risky = RISKY_WORDS.some((w) => body.content.includes(w));
    return ok({ pass: !risky, suggest: risky ? 'risky' : 'pass' });
  }),
];
