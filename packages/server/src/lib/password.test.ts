import bcryptjs from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('密码哈希统一入口（native/bcryptjs 互认）', () => {
  it('hashPassword 产出的 hash 可被 bcryptjs 校验（向后兼容存量校验路径）', async () => {
    const hash = await hashPassword('S3cret!密码');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await bcryptjs.compare('S3cret!密码', hash)).toBe(true);
  });

  it('bcryptjs 产出的存量 $2b$ hash 可被 verifyPassword 校验', async () => {
    const legacy = await bcryptjs.hash('legacy-pass', 4);
    expect(await verifyPassword('legacy-pass', legacy)).toBe(true);
    expect(await verifyPassword('wrong-pass', legacy)).toBe(false);
  });

  it('$2a$ 前缀的历史 hash 同样互认', async () => {
    // bcryptjs 支持显式生成 $2a$ 盐
    const salt = '$2a$04$C6UzMDM.H6dfI/f/IKcEe.';
    const legacy2a = await bcryptjs.hash('older-pass', salt);
    expect(legacy2a.startsWith('$2a$')).toBe(true);
    expect(await verifyPassword('older-pass', legacy2a)).toBe(true);
  });

  it('verifyPassword 对畸形 hash 返回 false 而不抛错', async () => {
    await expect(verifyPassword('x', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });
});
