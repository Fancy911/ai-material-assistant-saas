import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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

  @Get('me') @UseGuards(SessionGuard)
  async me(@CurrentSession() session: Session) {
    const [user, setting, successCount] = await Promise.all([this.prisma.user.findFirstOrThrow({ where: { id: session.sub, tenantId: session.tenantId } }), this.prisma.tenantSetting.findUnique({ where: { tenantId: session.tenantId } }), this.prisma.resolveJob.count({ where: { userId: session.sub, tenantId: session.tenantId, status: 'SUCCESS' } })]);
    return { id: user.id, pointsBalance: user.pointsBalance, miniappName: setting?.miniappName ?? 'AI素材助手', totalResolves: successCount };
  }

  @Get('me/history') @UseGuards(SessionGuard)
  history(@CurrentSession() session: Session) { return this.prisma.resolveJob.findMany({ where: { userId: session.sub, tenantId: session.tenantId }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, platform: true, status: true, mediaType: true, title: true, errorCode: true, createdAt: true } }); }
}
