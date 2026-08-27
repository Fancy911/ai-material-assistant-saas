import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, ResolveStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { seal, urlHash } from '../common/security';
import { CanxiangProvider, extractSupportedUrl, MockProvider, ResolverProvider } from './providers';

@Injectable()
export class ResolveService {
  constructor(private readonly prisma: PrismaService, private readonly mock: MockProvider, private readonly canxiang: CanxiangProvider) {}
  private provider(): ResolverProvider { return process.env.RESOLVER_MODE === 'canxiang' ? this.canxiang : this.mock; }
  async submit(tenantId: string, userId: string, input: string, idempotencyKey?: string) {
    const matched = extractSupportedUrl(input); if (!matched) throw new ForbiddenException('UNSUPPORTED_PLATFORM');
    const now = new Date(); const [tenant, user, setting, cap] = await Promise.all([this.prisma.tenant.findUnique({ where: { id: tenantId } }), this.prisma.user.findUnique({ where: { id: userId } }), this.prisma.tenantSetting.findUnique({ where: { tenantId } }), this.prisma.tenantCapability.findUnique({ where: { tenantId_capability: { tenantId, capability: matched.platform } } })]);
    if (!tenant || tenant.status !== 'ACTIVE') throw new ForbiddenException('TENANT_SUSPENDED');
    if (tenant.expiresAt && tenant.expiresAt <= now) throw new ForbiddenException('TENANT_EXPIRED');
    if (!cap?.enabled) throw new ForbiddenException('CAPABILITY_DISABLED');
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('USER_DISABLED');
    const fingerprint = urlHash(matched.url);
    const duplicate = await this.prisma.resolveJob.findFirst({ where: { tenantId, userId, urlHash: fingerprint, createdAt: { gte: new Date(Date.now() - 60_000) }, status: { in: [ResolveStatus.PENDING, ResolveStatus.RUNNING, ResolveStatus.SUCCESS] } }, include: { media: true } });
    if (duplicate) return duplicate;
    if (idempotencyKey) { const previous = await this.prisma.resolveJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, include: { media: true } }); if (previous) return previous; }
    const job = await this.prisma.resolveJob.create({ data: { tenantId, userId, platform: matched.platform, urlHash: fingerprint, urlHost: new URL(matched.url).host, status: 'RUNNING', idempotencyKey } });
    const started = Date.now();
    try {
      const result = await this.provider().resolve(matched.platform, matched.url); const latencyMs = Date.now() - started;
      if (!result.success || !result.media.length) { return this.prisma.resolveJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorCode: result.errorCode || 'MEDIA_NOT_FOUND', provider: result.provider, latencyMs, completedAt: new Date() } }); }
      const cost = setting?.pointCost ?? 1; const secret = process.env.MEDIA_PROXY_SIGNING_KEY || 'development-only-change-me';
      return await this.prisma.$transaction(async (tx) => {
        const userDebit = await tx.user.updateMany({ where: { id: userId, tenantId, status: 'ACTIVE', pointsBalance: { gte: cost } }, data: { pointsBalance: { decrement: cost }, lastActiveAt: new Date() } });
        if (userDebit.count !== 1) throw new ForbiddenException('NO_POINTS');
        const quotaDebit = await tx.tenant.updateMany({ where: { id: tenantId, status: 'ACTIVE', quotaRemaining: { gte: 1 } }, data: { quotaRemaining: { decrement: 1 } } });
        if (quotaDebit.count !== 1) throw new ForbiddenException('TENANT_QUOTA_EMPTY');
        await tx.pointsLedger.create({ data: { tenantId, userId, delta: -cost, reason: 'RESOLVE_SUCCESS', refType: 'resolve_job', refId: job.id } });
        await tx.quotaLedger.create({ data: { tenantId, delta: -1, reason: 'RESOLVE_SUCCESS', refId: job.id } });
        await tx.resolveMedia.createMany({ data: result.media.map((item) => ({ jobId: job.id, type: item.type === 'image' ? 'IMAGE' : 'VIDEO', sourceUrlEnc: seal(item.sourceUrl, secret), metaJson: { width: item.width, height: item.height, sizeBytes: item.sizeBytes, mimeType: item.mimeType } as Prisma.InputJsonValue })) });
        return tx.resolveJob.update({ where: { id: job.id }, data: { status: 'SUCCESS', mediaType: result.mediaType, title: result.title, provider: result.provider, latencyMs, completedAt: new Date() }, include: { media: true } });
      });
    } catch (error) {
      const code = error instanceof ForbiddenException ? String(error.message) : error instanceof Error && error.name === 'TimeoutError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR';
      await this.prisma.resolveJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorCode: code, latencyMs: Date.now() - started, completedAt: new Date() } });
      if (error instanceof ForbiddenException) throw error; throw new ServiceUnavailableException(code);
    }
  }
  async getJob(tenantId: string, userId: string, id: string) { const job = await this.prisma.resolveJob.findFirst({ where: { id, tenantId, userId }, include: { media: { select: { id: true, type: true, metaJson: true } } } }); if (!job) throw new ForbiddenException('JOB_NOT_FOUND'); return job; }
}

