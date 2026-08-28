import { Body, Controller, Get, Post, UseGuards, BadRequestException, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentSession, Session, SessionGuard } from './auth';
import { open } from '../common/security';

const secretKey = () => process.env.SECRET_ENCRYPTION_KEY || process.env.MEDIA_PROXY_SIGNING_KEY || 'development-only-change-me';

@Controller('api')
export class AuthController {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  @Post('auth/wechat-login')
  async wechatLogin(@Body() body: { code?: string; tenantCode?: string }) {
    const tenantCode = body.tenantCode?.trim().toLowerCase();
    if (!tenantCode || !/^[a-z0-9-]{3,64}$/.test(tenantCode)) throw new BadRequestException('INVALID_TENANT_CODE');
    if (!body.code?.trim() || body.code.length > 512) throw new BadRequestException('INVALID_WECHAT_CODE');
    const tenant = await this.prisma.tenant.findUnique({ where: { publicCode: tenantCode } });
    if (!tenant) throw new UnauthorizedException('TENANT_NOT_FOUND');
    const setting = await this.prisma.tenantSetting.findUnique({ where: { tenantId: tenant.id } });
    let openid: string;
    if (process.env.AUTH_MODE !== 'wechat') {
      openid = `mock-${tenantCode}-${body.code.slice(0, 48)}`;
    } else {
      if (!setting?.appid || !setting.appsecretCiphertext) throw new ForbiddenException('TENANT_WECHAT_NOT_CONFIGURED');
      let appsecret: string;
      try { appsecret = open(setting.appsecretCiphertext, secretKey()); } catch { throw new ServiceUnavailableException('TENANT_WECHAT_SECRET_INVALID'); }
      const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
      url.searchParams.set('appid', setting.appid); url.searchParams.set('secret', appsecret); url.searchParams.set('js_code', body.code); url.searchParams.set('grant_type', 'authorization_code');
      let response: Response; let payload: { openid?: string; errcode?: number; errmsg?: string };
      try { response = await fetch(url, { signal: AbortSignal.timeout(10_000) }); payload = await response.json() as typeof payload; } catch { throw new ServiceUnavailableException('WECHAT_LOGIN_UNAVAILABLE'); }
      if (!response.ok || !payload.openid) throw new UnauthorizedException(payload.errmsg || 'WECHAT_LOGIN_FAILED');
      openid = payload.openid;
    }
    const tenantId = tenant.id;
    const user = await this.prisma.user.upsert({ where: { tenantId_openid: { tenantId, openid } }, update: { lastActiveAt: new Date() }, create: { tenantId, openid, pointsBalance: setting?.initialPoints ?? 10, lastActiveAt: new Date() } });
    const accessToken = await this.jwt.signAsync({ sub: user.id, tenantId, role: 'USER' }, { expiresIn: '1h' });
    return { accessToken, user: { id: user.id, pointsBalance: user.pointsBalance }, tenant: { code: tenant.publicCode, name: setting?.miniappName || tenant.name } };
  }

  @Post('auth/admin-login')
  async adminLogin(@Body() body: { account?: string; password?: string }) {
    if (!body.account || !body.password) throw new BadRequestException('INVALID_CREDENTIALS');
    const admin = await this.prisma.tenantAdmin.findUnique({ where: { account: body.account.trim() } });
    if (!admin || !(await argon2.verify(admin.passwordHash, body.password))) throw new UnauthorizedException('INVALID_CREDENTIALS');
    const accessToken = await this.jwt.signAsync({ sub: admin.id, tenantId: admin.tenantId ?? undefined, role: admin.role }, { expiresIn: '1h' });
    return { accessToken, admin: { id: admin.id, account: admin.account, role: admin.role } };
  }

  @Get('me') @UseGuards(SessionGuard)
  async me(@CurrentSession() session: Session) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tenantId = session.tenantId!;
    const [user, setting, tenant, successCount, todaySuccess, activation] = await Promise.all([this.prisma.user.findFirstOrThrow({ where: { id: session.sub, tenantId } }), this.prisma.tenantSetting.findUnique({ where: { tenantId } }), this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { status: true, expiresAt: true } }), this.prisma.resolveJob.count({ where: { userId: session.sub, tenantId, status: 'SUCCESS' } }), this.prisma.resolveJob.count({ where: { userId: session.sub, tenantId, status: 'SUCCESS', createdAt: { gte: today } } }), this.prisma.tenantActivationCode.findFirst({ where: { tenantId, status: 'ACTIVATED' }, select: { activatedAt: true } })]);
    const expired = Boolean(tenant.expiresAt && tenant.expiresAt <= new Date());
    return { id: user.id, pointsBalance: user.pointsBalance, miniappName: setting?.miniappName ?? 'AI素材助手', totalResolves: successCount, todayResolves: todaySuccess, pointCost: setting?.pointCost ?? 1, notice: setting?.notice ?? null, service: { activated: Boolean(activation), activatedAt: activation?.activatedAt ?? null, tenantStatus: expired ? 'EXPIRED' : tenant.status, canResolve: Boolean(activation) && tenant.status === 'ACTIVE' && !expired } };
  }

  @Get('me/history') @UseGuards(SessionGuard)
  history(@CurrentSession() session: Session) { return this.prisma.resolveJob.findMany({ where: { userId: session.sub, tenantId: session.tenantId }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, platform: true, status: true, mediaType: true, title: true, errorCode: true, createdAt: true } }); }

  @Post('redeem') @UseGuards(SessionGuard)
  async redeem(@CurrentSession() session: Session, @Body() body: { code?: string }) {
    const code = body.code?.trim().toUpperCase(); if (!code || code.length > 128) throw new BadRequestException('INVALID_REDEEM_CODE');
    const codeHash = createHash('sha256').update(code).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      const redeemCode = await tx.redeemCode.findFirst({ where: { tenantId: session.tenantId, codeHash, status: 'UNUSED', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
      if (!redeemCode) throw new BadRequestException('REDEEM_CODE_UNAVAILABLE');
      const claimed = await tx.redeemCode.updateMany({ where: { id: redeemCode.id, tenantId: session.tenantId, status: 'UNUSED' }, data: { status: 'REDEEMED', redeemedById: session.sub, redeemedAt: new Date() } });
      if (claimed.count !== 1) throw new BadRequestException('REDEEM_CODE_ALREADY_USED');
      const user = await tx.user.update({ where: { id: session.sub }, data: { pointsBalance: { increment: redeemCode.points } } });
      await tx.pointsLedger.create({ data: { tenantId: session.tenantId!, userId: session.sub, delta: redeemCode.points, reason: 'REDEEM_CODE', refType: 'redeem_code', refId: redeemCode.id } });
      return { pointsAdded: redeemCode.points, pointsBalance: user.pointsBalance };
    });
  }

  @Post('paywall-intent') @UseGuards(SessionGuard)
  async paywallIntent(@CurrentSession() session: Session, @Body() body: { packageSelected?: string }) {
    await this.prisma.event.create({ data: { tenantId: session.tenantId!, userId: session.sub, eventName: 'paywall_intent', metaJson: { packageSelected: body.packageSelected || 'unknown' } } });
    return { recorded: true };
  }
}
