import { useEffect, useState } from 'react';
import type { User } from '@zenith/shared/identity';

// 本地维护 displayUser，通过 auth:user-updated 事件直接更新头像，
// 避免触发整条 App.tsx → Provider 树的重渲染链路。
export function useDisplayUser(userProp: Omit<User, 'password'>) {
  const [displayUser, setDisplayUser] = useState(userProp);
  useEffect(() => { setDisplayUser(userProp); }, [userProp]);
  useEffect(() => {
    function handler(e: Event) {
      const updated = (e as CustomEvent<Omit<User, 'password'>>).detail;
      setDisplayUser((prev) => (prev.id === updated.id ? updated : prev));
    }
    globalThis.addEventListener('auth:user-updated', handler);
    return () => globalThis.removeEventListener('auth:user-updated', handler);
  }, []);
  return displayUser;
}
