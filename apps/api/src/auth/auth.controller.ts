import { Body, Controller, Get, Post, UseGuards, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentSession, Session, SessionGuard } from './auth';

@Controller('api')
export class AuthController {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  @Post('auth/wechat-login')
  async wechatLogin(@Body() body: { code?: string }) {
    // P0 local development only. Production exchanges a WeChat code server-side.
    const tenantId = process.env.MOCK_LOGIN_TENANT_ID || 'tenant-demo-a';
    const openid = `mock-${(body.code || 'anonymous').slice(0, 48)}`;
    const setting = await this.prisma.tenantSetting.findUnique({ where: { tenantId } });
    const user = await this.prisma.user.upsert({ where: { tenantId_openid: { tenantId, openid } }, update: { lastActiveAt: new Date() }, create: { tenantId, openid, pointsBalance: setting?.initialPoints ?? 10, lastActiveAt: new Date() } });
    const accessToken = await this.jwt.signAsync({ sub: user.id, tenantId, role: 'USER' }, { expiresIn: '1h' });
    return { accessToken, user: { id: user.id, pointsBalance: user.pointsBalance } };
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
    const [user, setting, successCount] = await Promise.all([this.prisma.user.findFirstOrThrow({ where: { id: session.sub, tenantId: session.tenantId } }), this.prisma.tenantSetting.findUnique({ where: { tenantId: session.tenantId } }), this.prisma.resolveJob.count({ where: { userId: session.sub, tenantId: session.tenantId, status: 'SUCCESS' } })]);
    return { id: user.id, pointsBalance: user.pointsBalance, miniappName: setting?.miniappName ?? 'AI素材助手', totalResolves: successCount };
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
