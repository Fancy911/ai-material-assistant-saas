import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma, ProviderStatus, RedeemStatus, TenantStatus, UserStatus } from '@prisma/client';
import { CurrentSession, requireRole, Session, SessionGuard } from '../auth/auth';
import { seal } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';

const dayStart = () => { const value = new Date(); value.setHours(0, 0, 0, 0); return value; };
const pageValue = (value?: string) => Math.max(1, Math.min(10_000, Number(value) || 1));
const takeValue = (value?: string) => Math.max(1, Math.min(100, Number(value) || 20));
const mask = (value?: string | null) => value ? `••••${value.slice(-4)}` : null;
const secretKey = () => process.env.SECRET_ENCRYPTION_KEY || process.env.MEDIA_PROXY_SIGNING_KEY || 'development-only-change-me';
const codeHash = (code: string) => createHash('sha256').update(code).digest('hex');

@Controller('api/tenant-admin')
@UseGuards(SessionGuard)
export class TenantAdminController {
  constructor(private readonly prisma: PrismaService) {}
  private tenant(session: Session) { requireRole(session, 'TENANT_ADMIN'); if (!session.tenantId) throw new BadRequestException('TENANT_SCOPE_REQUIRED'); return session.tenantId; }
  private async audit(session: Session, action: string, targetType: string, targetId?: string, metaJson?: Prisma.InputJsonValue) { await this.prisma.auditLog.create({ data: { tenantId: this.tenant(session), actorId: session.sub, action, targetType, targetId, metaJson } }); }

  @Get('overview')
  async overview(@CurrentSession() session: Session) {
    const tenantId = this.tenant(session); const since = dayStart();
    const [tenant, users, todayJobs, todaySuccess, newUsers, pointSum, todayRedemptions, capabilityRows, distribution] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { capabilities: { where: { enabled: true } } } }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.resolveJob.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.resolveJob.count({ where: { tenantId, createdAt: { gte: since }, status: 'SUCCESS' } }),
      this.prisma.user.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.user.aggregate({ where: { tenantId }, _sum: { pointsBalance: true } }),
      this.prisma.redeemCode.count({ where: { tenantId, status: 'REDEEMED', redeemedAt: { gte: since } } }),
      this.prisma.tenantCapability.findMany({ where: { tenantId, enabled: true }, select: { capability: true } }),
      this.prisma.resolveJob.groupBy({ by: ['platform'], where: { tenantId, status: 'SUCCESS', createdAt: { gte: since } }, _count: { _all: true } }),
    ]);
    const enabled = new Set(capabilityRows.map((row) => row.capability));
    return { tenant: { name: tenant.name, status: tenant.status, quotaTotal: tenant.quotaTotal, quotaRemaining: tenant.quotaRemaining }, metrics: { todayResolves: todayJobs, successRate: todayJobs ? Number((todaySuccess / todayJobs).toFixed(4)) : null, users, newUsers, pointsTotal: pointSum._sum.pointsBalance || 0, todayRedemptions }, platformDistribution: distribution.filter((row) => enabled.has(row.platform)).map((row) => ({ platform: row.platform, count: row._count._all })), capabilities: capabilityRows };
  }

  @Get('users')
  async users(@CurrentSession() session: Session, @Query('page') page?: string, @Query('size') size?: string, @Query('q') q?: string, @Query('status') status?: UserStatus) {
    const tenantId = this.tenant(session); const take = takeValue(size); const current = pageValue(page);
    if (status && !Object.values(UserStatus).includes(status)) throw new BadRequestException('INVALID_USER_STATUS');
    const where = { tenantId, ...(status ? { status } : {}), ...(q?.trim() ? { openid: { contains: q.trim(), mode: 'insensitive' as const } } : {}) };
    const [total, rows] = await this.prisma.$transaction([this.prisma.user.count({ where }), this.prisma.user.findMany({ where, skip: (current - 1) * take, take, orderBy: { createdAt: 'desc' }, select: { id: true, openid: true, pointsBalance: true, status: true, createdAt: true, lastActiveAt: true, _count: { select: { jobs: true } } } })]);
    return { page: current, size: take, total, items: rows.map((row) => ({ ...row, openid: `用户 ${row.openid.slice(-8)}`, resolves: row._count.jobs })) };
  }

  @Patch('users/:id/points')
  async adjustPoints(@CurrentSession() session: Session, @Param('id') userId: string, @Body() body: { delta?: number; reason?: string }) {
    const tenantId = this.tenant(session); const delta = Number(body.delta); const reason = body.reason?.trim();
    if (!Number.isInteger(delta) || !delta || Math.abs(delta) > 100_000 || !reason || reason.length > 200) throw new BadRequestException('INVALID_POINTS_ADJUSTMENT');
    const refId = `admin:${session.sub}:${Date.now()}`;
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({ where: { id: userId, tenantId, ...(delta < 0 ? { pointsBalance: { gte: -delta } } : {}) }, data: { pointsBalance: { increment: delta } } });
      if (updated.count !== 1) throw new BadRequestException('USER_NOT_FOUND_OR_INSUFFICIENT_POINTS');
      const value = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { pointsBalance: true } });
      await tx.pointsLedger.create({ data: { tenantId, userId, delta, reason: 'ADMIN_ADJUST', refType: reason, refId } });
      return value;
    });
    await this.audit(session, 'USER_POINTS_ADJUSTED', 'user', userId, { delta, reason, refId }); return user;
  }

  @Get('points-ledger')
  async pointsLedger(@CurrentSession() session: Session, @Query('page') page?: string, @Query('size') size?: string) {
    const tenantId = this.tenant(session); const take = takeValue(size); const current = pageValue(page); const where = { tenantId };
    const [total, items] = await this.prisma.$transaction([this.prisma.pointsLedger.count({ where }), this.prisma.pointsLedger.findMany({ where, take, skip: (current - 1) * take, orderBy: { createdAt: 'desc' }, include: { user: { select: { openid: true } } } })]);
    return { page: current, size: take, total, items: items.map((item) => ({ ...item, user: `用户 ${item.user.openid.slice(-8)}` })) };
  }

  @Post('redeem-codes')
  async createCodes(@CurrentSession() session: Session, @Body() body: { points?: number; count?: number; expiresAt?: string }) {
    const tenantId = this.tenant(session); const points = Number(body.points); const count = Number(body.count || 1); const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (!Number.isInteger(points) || points < 1 || points > 100_000 || !Number.isInteger(count) || count < 1 || count > 100 || (expiresAt && Number.isNaN(expiresAt.valueOf()))) throw new BadRequestException('INVALID_REDEEM_CODE_REQUEST');
    const codes = Array.from({ length: count }, () => `BXY-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`);
    await this.prisma.$transaction(codes.map((code) => this.prisma.redeemCode.create({ data: { tenantId, codeHash: codeHash(code), codeHint: `${code.slice(0, 5)}••${code.slice(-4)}`, points, expiresAt } })));
    await this.audit(session, 'REDEEM_CODES_CREATED', 'redeem_code', undefined, { count, points, expiresAt: expiresAt?.toISOString() || null }); return { codes };
  }

  @Get('redeem-codes')
  async codes(@CurrentSession() session: Session, @Query('page') page?: string, @Query('size') size?: string, @Query('status') status?: RedeemStatus) {
    const tenantId = this.tenant(session); const take = takeValue(size); const current = pageValue(page); if (status && !Object.values(RedeemStatus).includes(status)) throw new BadRequestException('INVALID_REDEEM_STATUS');
    const where = { tenantId, ...(status ? { status } : {}) }; const [total, items] = await this.prisma.$transaction([this.prisma.redeemCode.count({ where }), this.prisma.redeemCode.findMany({ where, take, skip: (current - 1) * take, orderBy: { createdAt: 'desc' }, select: { id: true, codeHint: true, points: true, status: true, expiresAt: true, redeemedAt: true, createdAt: true, redeemedBy: { select: { openid: true } } } })]);
    return { page: current, size: take, total, items: items.map((item) => ({ ...item, redeemedBy: item.redeemedBy ? `用户 ${item.redeemedBy.openid.slice(-8)}` : null })) };
  }

  @Patch('redeem-codes/:id/disable')
  async disableCode(@CurrentSession() session: Session, @Param('id') id: string) { const tenantId = this.tenant(session); const value = await this.prisma.redeemCode.updateMany({ where: { id, tenantId, status: 'UNUSED' }, data: { status: 'DISABLED' } }); if (value.count !== 1) throw new BadRequestException('REDEEM_CODE_NOT_AVAILABLE'); await this.audit(session, 'REDEEM_CODE_DISABLED', 'redeem_code', id); return { disabled: true }; }

  @Get('resolve-jobs')
  async jobs(@CurrentSession() session: Session, @Query('page') page?: string, @Query('size') size?: string) {
    const tenantId = this.tenant(session); const take = takeValue(size); const current = pageValue(page); const where = { tenantId }; const [total, items] = await this.prisma.$transaction([this.prisma.resolveJob.count({ where }), this.prisma.resolveJob.findMany({ where, take, skip: (current - 1) * take, orderBy: { createdAt: 'desc' }, include: { user: { select: { openid: true } }, providerCalls: { select: { costEstimate: true } } } })]);
    return { page: current, size: take, total, items: items.map(({ user, providerCalls, content: _content, ...item }) => ({ ...item, user: `用户 ${user.openid.slice(-8)}`, cost: providerCalls.reduce((sum, call) => sum + Number(call.costEstimate), 0) })) };
  }

  @Get('quota-capabilities')
  async quotaCapabilities(@CurrentSession() session: Session) { const tenantId = this.tenant(session); const [tenant, capabilities] = await Promise.all([this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { quotaTotal: true, quotaRemaining: true, expiresAt: true } }), this.prisma.tenantCapability.findMany({ where: { tenantId }, orderBy: { capability: 'asc' } })]); return { tenant, capabilities }; }
  @Patch('capabilities/:capability')
  async updateCapability(@CurrentSession() session: Session, @Param('capability') capability: string, @Body() body: { enabled?: boolean }) { const tenantId = this.tenant(session); if (typeof body.enabled !== 'boolean') throw new BadRequestException('INVALID_CAPABILITY_UPDATE'); const cap = await this.prisma.tenantCapability.findUnique({ where: { tenantId_capability: { tenantId, capability } } }); if (!cap) throw new BadRequestException('CAPABILITY_NOT_GRANTED'); const value = await this.prisma.tenantCapability.update({ where: { id: cap.id }, data: { enabled: body.enabled } }); await this.audit(session, 'TENANT_CAPABILITY_UPDATED', 'capability', value.id, { capability, enabled: body.enabled }); return value; }

  @Get('settings')
  async settings(@CurrentSession() session: Session) { const tenantId = this.tenant(session); const setting = await this.prisma.tenantSetting.findUniqueOrThrow({ where: { tenantId } }); return { ...setting, appsecretCiphertext: mask(setting.appsecretCiphertext) }; }
  @Patch('settings')
  async updateSettings(@CurrentSession() session: Session, @Body() body: { miniappName?: string; notice?: string | null; initialPoints?: number; pointCost?: number; appsecret?: string; appid?: string; contact?: string; paywallEnabled?: boolean }) {
    const tenantId = this.tenant(session); const data: Prisma.TenantSettingUpdateInput = {};
    if (body.miniappName !== undefined) { if (!body.miniappName.trim() || body.miniappName.length > 60) throw new BadRequestException('INVALID_MINIAPP_NAME'); data.miniappName = body.miniappName.trim(); }
    if (body.notice !== undefined) data.notice = body.notice?.slice(0, 500) || null; if (body.initialPoints !== undefined) { if (!Number.isInteger(body.initialPoints) || body.initialPoints < 0 || body.initialPoints > 100_000) throw new BadRequestException('INVALID_INITIAL_POINTS'); data.initialPoints = body.initialPoints; }
    if (body.pointCost !== undefined) { if (!Number.isInteger(body.pointCost) || body.pointCost < 1 || body.pointCost > 1000) throw new BadRequestException('INVALID_POINT_COST'); data.pointCost = body.pointCost; }
    if (body.appid !== undefined) data.appid = body.appid.trim() || null; if (body.appsecret !== undefined) data.appsecretCiphertext = body.appsecret ? seal(body.appsecret, secretKey()) : null;
    const setting = await this.prisma.tenantSetting.update({ where: { tenantId }, data }); await this.audit(session, 'TENANT_SETTINGS_UPDATED', 'tenant_setting', setting.id, { changed: Object.keys(data) }); return { ...setting, appsecretCiphertext: mask(setting.appsecretCiphertext) };
  }
}

@Controller('api/super-admin')
@UseGuards(SessionGuard)
export class SuperAdminController {
  constructor(private readonly prisma: PrismaService) {}
  private super(session: Session) { requireRole(session, 'SUPER_ADMIN'); }
  private async audit(session: Session, action: string, targetType: string, targetId?: string, metaJson?: Prisma.InputJsonValue) { await this.prisma.auditLog.create({ data: { actorId: session.sub, action, targetType, targetId, metaJson } }); }

  @Get('overview')
  async overview(@CurrentSession() session: Session) { this.super(session); const since = dayStart(); const [tenants, users, newUsers, jobs, success, calls, cost, latency, byTenant, byPlatform] = await Promise.all([this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }), this.prisma.user.count(), this.prisma.user.count({ where: { createdAt: { gte: since } } }), this.prisma.resolveJob.count({ where: { createdAt: { gte: since } } }), this.prisma.resolveJob.count({ where: { createdAt: { gte: since }, status: 'SUCCESS' } }), this.prisma.providerCall.count({ where: { createdAt: { gte: since } } }), this.prisma.providerCall.aggregate({ where: { createdAt: { gte: since } }, _sum: { costEstimate: true } }), this.prisma.providerCall.aggregate({ where: { createdAt: { gte: since } }, _avg: { latencyMs: true } }), this.prisma.resolveJob.groupBy({ by: ['tenantId'], where: { createdAt: { gte: since } }, _count: { _all: true } }), this.prisma.resolveJob.groupBy({ by: ['platform'], where: { createdAt: { gte: since } }, _count: { _all: true } })]); return { tenantStatus: tenants.map((row) => ({ status: row.status, count: row._count._all })), metrics: { users, newUsers, todayResolves: jobs, successRate: jobs ? Number((success / jobs).toFixed(4)) : null, providerCalls: calls, cost: Number(cost._sum.costEstimate || 0), averageLatencyMs: Math.round(latency._avg.latencyMs || 0) }, byTenant, byPlatform }; }

  @Get('tenants')
  async tenants(@CurrentSession() session: Session, @Query('page') page?: string, @Query('size') size?: string) { this.super(session); const take = takeValue(size); const current = pageValue(page); const [total, items] = await this.prisma.$transaction([this.prisma.tenant.count(), this.prisma.tenant.findMany({ take, skip: (current - 1) * take, orderBy: { createdAt: 'desc' }, include: { _count: { select: { users: true, admins: true, jobs: true } }, capabilities: { where: { enabled: true }, select: { capability: true } } } })]); return { page: current, size: take, total, items }; }

  @Post('tenants')
  async createTenant(@CurrentSession() session: Session, @Body() body: { name?: string; quotaTotal?: number; expiresAt?: string; capabilities?: string[]; adminAccount?: string; adminPassword?: string }) { this.super(session); const name = body.name?.trim(); const quota = Number(body.quotaTotal); if (!name || name.length > 80 || !Number.isInteger(quota) || quota < 0 || quota > 10_000_000 || !body.adminAccount?.trim() || !body.adminPassword || body.adminPassword.length < 10) throw new BadRequestException('INVALID_TENANT_CREATE'); const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null; if (expiresAt && Number.isNaN(expiresAt.valueOf())) throw new BadRequestException('INVALID_EXPIRY'); const tenant = await this.prisma.$transaction(async (tx) => { const value = await tx.tenant.create({ data: { name, quotaTotal: quota, quotaRemaining: quota, expiresAt } }); await tx.tenantSetting.create({ data: { tenantId: value.id } }); await tx.tenantAdmin.create({ data: { tenantId: value.id, account: body.adminAccount!.trim(), passwordHash: await argon2.hash(body.adminPassword!), role: 'TENANT_ADMIN' } }); for (const capability of [...new Set(body.capabilities || [])]) await tx.tenantCapability.create({ data: { tenantId: value.id, capability, enabled: true } }); return value; }); await this.audit(session, 'TENANT_CREATED', 'tenant', tenant.id, { name, quota, capabilities: body.capabilities || [] }); return tenant; }

  @Patch('tenants/:id')
  async updateTenant(@CurrentSession() session: Session, @Param('id') id: string, @Body() body: { name?: string; status?: TenantStatus; expiresAt?: string | null; capabilities?: string[] }) { this.super(session); const data: Prisma.TenantUpdateInput = {}; if (body.name !== undefined) { if (!body.name.trim() || body.name.length > 80) throw new BadRequestException('INVALID_TENANT_NAME'); data.name = body.name.trim(); } if (body.status !== undefined) { if (!Object.values(TenantStatus).includes(body.status)) throw new BadRequestException('INVALID_TENANT_STATUS'); data.status = body.status; } if (body.expiresAt !== undefined) { const value = body.expiresAt ? new Date(body.expiresAt) : null; if (value && Number.isNaN(value.valueOf())) throw new BadRequestException('INVALID_EXPIRY'); data.expiresAt = value; } const tenant = await this.prisma.tenant.update({ where: { id }, data }); if (body.capabilities) { await this.prisma.$transaction([this.prisma.tenantCapability.deleteMany({ where: { tenantId: id } }), ...[...new Set(body.capabilities)].map((capability) => this.prisma.tenantCapability.create({ data: { tenantId: id, capability, enabled: true } }))]); } await this.audit(session, 'TENANT_UPDATED', 'tenant', id, { changed: Object.keys(body) }); return tenant; }

  @Patch('tenants/:id/quota')
  async adjustQuota(@CurrentSession() session: Session, @Param('id') id: string, @Body() body: { delta?: number; reason?: string }) { this.super(session); const delta = Number(body.delta); const reason = body.reason?.trim(); if (!Number.isInteger(delta) || !delta || !reason || reason.length > 200) throw new BadRequestException('INVALID_QUOTA_ADJUSTMENT'); const refId = `super:${session.sub}:${Date.now()}`; const tenant = await this.prisma.$transaction(async (tx) => { const value = await tx.tenant.updateMany({ where: { id, ...(delta < 0 ? { quotaRemaining: { gte: -delta }, quotaTotal: { gte: -delta } } : {}) }, data: { quotaTotal: { increment: delta }, quotaRemaining: { increment: delta } } }); if (value.count !== 1) throw new BadRequestException('TENANT_NOT_FOUND_OR_QUOTA_TOO_LOW'); await tx.quotaLedger.create({ data: { tenantId: id, delta, reason: 'ADMIN_ADJUST', note: reason, refId } }); return tx.tenant.findUniqueOrThrow({ where: { id } }); }); await this.audit(session, 'TENANT_QUOTA_ADJUSTED', 'tenant', id, { delta, reason, refId }); return tenant; }

  @Patch('tenants/:id/admin-password')
  async resetPassword(@CurrentSession() session: Session, @Param('id') tenantId: string, @Body() body: { password?: string }) { this.super(session); if (!body.password || body.password.length < 10) throw new BadRequestException('INVALID_PASSWORD'); const admin = await this.prisma.tenantAdmin.findFirst({ where: { tenantId, role: 'TENANT_ADMIN' } }); if (!admin) throw new BadRequestException('TENANT_ADMIN_NOT_FOUND'); await this.prisma.tenantAdmin.update({ where: { id: admin.id }, data: { passwordHash: await argon2.hash(body.password) } }); await this.audit(session, 'TENANT_ADMIN_PASSWORD_RESET', 'tenant_admin', admin.id); return { reset: true }; }

  @Get('providers')
  async providers(@CurrentSession() session: Session) { this.super(session); const items = await this.prisma.provider.findMany({ orderBy: [{ priority: 'asc' }, { code: 'asc' }], include: { secret: { select: { last4: true, updatedAt: true } } } }); return items.map(({ secret, ...item }) => ({ ...item, secret: secret ? { configured: true, last4: `••••${secret.last4}`, updatedAt: secret.updatedAt } : { configured: item.code === 'zhiling' ? Boolean(process.env.ZHILING_API_KEY) : false, last4: null } })); }
  @Patch('providers/:code')
  async updateProvider(@CurrentSession() session: Session, @Param('code') code: string, @Body() body: { status?: ProviderStatus; priority?: number; baseUrl?: string; costConfig?: Prisma.InputJsonValue; secret?: string }) { this.super(session); const existing = await this.prisma.provider.findUnique({ where: { code } }); if (!existing) throw new BadRequestException('PROVIDER_NOT_FOUND'); const data: Prisma.ProviderUpdateInput = {}; if (body.status !== undefined) { if (!Object.values(ProviderStatus).includes(body.status)) throw new BadRequestException('INVALID_PROVIDER_STATUS'); data.status = body.status; } if (body.priority !== undefined) { if (!Number.isInteger(body.priority) || body.priority < 1 || body.priority > 999) throw new BadRequestException('INVALID_PRIORITY'); data.priority = body.priority; } if (body.baseUrl !== undefined) { try { new URL(body.baseUrl); } catch { throw new BadRequestException('INVALID_PROVIDER_URL'); } data.baseUrl = body.baseUrl; } if (body.costConfig !== undefined) data.costConfig = body.costConfig; const provider = await this.prisma.provider.update({ where: { code }, data }); if (body.secret !== undefined) { if (!body.secret.trim()) throw new BadRequestException('INVALID_PROVIDER_SECRET'); await this.prisma.providerSecret.upsert({ where: { providerId: provider.id }, update: { tokenCiphertext: seal(body.secret.trim(), secretKey()), last4: body.secret.trim().slice(-4) }, create: { providerId: provider.id, tokenCiphertext: seal(body.secret.trim(), secretKey()), last4: body.secret.trim().slice(-4) } }); } await this.audit(session, 'PROVIDER_UPDATED', 'provider', provider.id, { code, changed: Object.keys(body).filter((key) => key !== 'secret') }); return { code: provider.code, status: provider.status, priority: provider.priority }; }
  @Get('provider-calls')
  async providerCalls(@CurrentSession() session: Session, @Query('page') page?: string, @Query('size') size?: string) { this.super(session); const take = takeValue(size); const current = pageValue(page); const [total, items] = await this.prisma.$transaction([this.prisma.providerCall.count(), this.prisma.providerCall.findMany({ take, skip: (current - 1) * take, orderBy: { createdAt: 'desc' }, include: { provider: { select: { code: true, name: true } }, job: { select: { tenantId: true, platform: true } } } })]); return { page: current, size: take, total, items: items.map(({ provider, job, ...item }) => ({ ...item, provider, tenantId: job.tenantId, platform: job.platform })) }; }
  @Get('audits')
  async audits(@CurrentSession() session: Session, @Query('page') page?: string, @Query('size') size?: string) { this.super(session); const take = takeValue(size); const current = pageValue(page); const [total, items] = await this.prisma.$transaction([this.prisma.auditLog.count(), this.prisma.auditLog.findMany({ take, skip: (current - 1) * take, orderBy: { createdAt: 'desc' } })]); return { page: current, size: take, total, items }; }
}
