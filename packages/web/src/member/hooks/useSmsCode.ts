import { useEffect, useRef, useState } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { memberRequest } from '../utils/member-request';

const PHONE_REGEX = /^1[3-9]\d{9}$/;

/**
 * 短信验证码发送 + 60s 倒计时复用 hook。
 * 非生产环境后端会回传 devCode（仅 NODE_ENV=development 的开发模式），便于联调时直接看到验证码。
 */
export function useSmsCode(scene: 'register' | 'login' | 'reset') {
  const [counting, setCounting] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const send = async (phone: string): Promise<boolean> => {
    if (!PHONE_REGEX.test(phone)) {
      Toast.warning('请输入正确的手机号');
      return false;
    }
    if (counting > 0) return false;
    const res = await memberRequest.post<{ sent: boolean; devCode?: string }>(
      '/api/member/auth/sms-code',
      { phone, scene },
    );
    if (res.code === 0) {
      Toast.success(res.data?.devCode ? `验证码已发送，开发验证码：${res.data.devCode}` : '验证码已发送');
      let n = 60;
      setCounting(n);
      timerRef.current = setInterval(() => {
        n -= 1;
        setCounting(n);
        if (n <= 0 && timerRef.current) clearInterval(timerRef.current);
      }, 1000);
      return true;
    }
    return false;
  };

  return { counting, send };
}
