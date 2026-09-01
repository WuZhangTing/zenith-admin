import { describe, expect, it, vi } from 'vitest';
import { requireCmsCollectPublishPermission } from './cms-collect-policy';
import { validateCmsCollectPageRange } from './cms-collect.service';

describe('CMS collection auto-publish policy', () => {
  it('denies autoPublish when collector lacks cms:content:publish', async () => {
    const check = vi.fn().mockResolvedValue(false);
    await expect(requireCmsCollectPublishPermission(true, check)).rejects.toMatchObject({ status: 403 });
    expect(check).toHaveBeenCalledOnce();
  });

  it('allows draft collection without publish permission', async () => {
    const check = vi.fn().mockResolvedValue(false);
    await expect(requireCmsCollectPublishPermission(false, check)).resolves.toBeUndefined();
    expect(check).not.toHaveBeenCalled();
  });

  it.each([
    [1, 1],
    [2, 4],
  ])('accepts a valid page range %i-%i', (start, end) => {
    expect(() => validateCmsCollectPageRange(start, end)).not.toThrow();
  });

  it('rejects an update that makes the end page precede the start page', () => {
    expect(() => validateCmsCollectPageRange(2, 1)).toThrowError('结束页不能小于起始页');
  });
});
