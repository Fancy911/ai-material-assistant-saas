import { ForbiddenException } from '@nestjs/common';
import { ResolveService } from './resolve.service';

const resolved = {
  success: true,
  provider: 'mock',
  platform: 'douyin',
  mediaType: 'video',
  media: [{ type: 'video', sourceUrl: 'https://cdn.example.com/video.mp4', mimeType: 'video/mp4' }],
};

function setup(options: { points?: number; quota?: number; duplicate?: unknown; result?: unknown } = {}) {
  const tx = {
    user: { updateMany: jest.fn().mockResolvedValue({ count: options.points ?? 1 }) },
    tenant: { updateMany: jest.fn().mockResolvedValue({ count: options.quota ?? 1 }) },
    pointsLedger: { create: jest.fn().mockResolvedValue({}) },
    quotaLedger: { create: jest.fn().mockResolvedValue({}) },
    resolveMedia: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    providerCall: { create: jest.fn().mockResolvedValue({}) },
    resolveJob: { update: jest.fn().mockImplementation(({ data }) => ({ id: 'job-1', ...data, media: [] })) },
  };
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', status: 'ACTIVE', quotaRemaining: 10 }) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', status: 'ACTIVE', pointsBalance: 10 }) },
    tenantSetting: { findUnique: jest.fn().mockResolvedValue({ pointCost: 2 }) },
    tenantCapability: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
    provider: { findUnique: jest.fn().mockResolvedValue(null) },
    resolveJob: {
      findFirst: jest.fn().mockResolvedValue(options.duplicate ?? null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'job-1' }),
    },
    $transaction: jest.fn(async (work: (transaction: typeof tx) => unknown) => work(tx)),
  };
  const mock = { resolve: jest.fn().mockResolvedValue(options.result ?? resolved) };
  const service = new ResolveService(prisma as any, mock as any, {} as any, {} as any);
  return { service, prisma, tx, mock };
}

describe('ResolveService accounting', () => {
  const previousMode = process.env.RESOLVER_MODE;
  const previousKey = process.env.MEDIA_PROXY_SIGNING_KEY;
  beforeEach(() => { process.env.RESOLVER_MODE = 'mock'; process.env.MEDIA_PROXY_SIGNING_KEY = 'unit-test-key'; });
  afterEach(() => { process.env.RESOLVER_MODE = previousMode; process.env.MEDIA_PROXY_SIGNING_KEY = previousKey; });

  it('debits points and quota with both ledgers only after a successful provider result', async () => {
    const { service, tx } = setup();
    await expect(service.submit('tenant-1', 'user-1', 'https://v.douyin.com/example')).resolves.toMatchObject({ status: 'SUCCESS' });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { pointsBalance: { decrement: 2 }, lastActiveAt: expect.any(Date) } }));
    expect(tx.tenant.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { quotaRemaining: { decrement: 1 } } }));
    expect(tx.pointsLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ delta: -2, reason: 'RESOLVE_SUCCESS' }) }));
    expect(tx.quotaLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ delta: -1, reason: 'RESOLVE_SUCCESS' }) }));
  });

  it('does not debit either balance when the provider returns no media', async () => {
    const { service, tx } = setup({ result: { success: false, provider: 'mock', platform: 'douyin', media: [], errorCode: 'UPSTREAM_FAILED' } });
    await expect(service.submit('tenant-1', 'user-1', 'https://v.douyin.com/example')).resolves.toMatchObject({ status: 'FAILED', errorCode: 'UPSTREAM_FAILED' });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.tenant.updateMany).not.toHaveBeenCalled();
    expect(tx.pointsLedger.create).not.toHaveBeenCalled();
    expect(tx.quotaLedger.create).not.toHaveBeenCalled();
  });

  it('rejects insufficient points before deducting tenant quota', async () => {
    const { service, tx } = setup({ points: 0 });
    await expect(service.submit('tenant-1', 'user-1', 'https://v.douyin.com/example')).rejects.toThrow(new ForbiddenException('NO_POINTS'));
    expect(tx.tenant.updateMany).not.toHaveBeenCalled();
    expect(tx.pointsLedger.create).not.toHaveBeenCalled();
    expect(tx.quotaLedger.create).not.toHaveBeenCalled();
  });

  it('returns a recent matching job without a second provider call', async () => {
    const duplicate = { id: 'existing-job', status: 'SUCCESS', media: [] };
    const { service, mock, prisma } = setup({ duplicate });
    await expect(service.submit('tenant-1', 'user-1', 'https://v.douyin.com/example')).resolves.toBe(duplicate);
    expect(mock.resolve).not.toHaveBeenCalled();
    expect(prisma.resolveJob.create).not.toHaveBeenCalled();
  });
});
