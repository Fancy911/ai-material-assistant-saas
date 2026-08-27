import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ProviderStatus } from '@prisma/client';
import { CurrentSession, requireRole, Session, SessionGuard } from '../auth/auth';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/admin/providers')
@UseGuards(SessionGuard)
export class AdminProviderController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentSession() session: Session) {
    requireRole(session, 'SUPER_ADMIN');
    const providers = await this.prisma.provider.findMany({ orderBy: [{ priority: 'asc' }, { code: 'asc' }] });
    return providers.map((provider) => ({
      code: provider.code,
      name: provider.name,
      status: provider.status,
      priority: provider.priority,
      baseUrl: provider.baseUrl,
      costConfig: provider.costConfig,
      configured: provider.code === 'zhiling' ? Boolean(process.env.ZHILING_API_KEY) : provider.code === 'canxiang' ? Boolean(process.env.CANXIANG_TOKEN) : provider.code === 'mock',
    }));
  }

  @Patch(':code')
  async update(@CurrentSession() session: Session, @Param('code') code: string, @Body() body: { status?: ProviderStatus; priority?: number }) {
    requireRole(session, 'SUPER_ADMIN');
    if (!code || (body.status !== undefined && !Object.values(ProviderStatus).includes(body.status)) || (body.priority !== undefined && (!Number.isInteger(body.priority) || body.priority < 1 || body.priority > 999))) throw new BadRequestException('INVALID_PROVIDER_UPDATE');
    const existing = await this.prisma.provider.findUnique({ where: { code } });
    if (!existing) throw new BadRequestException('PROVIDER_NOT_FOUND');
    const provider = await this.prisma.provider.update({ where: { code }, data: { ...(body.status === undefined ? {} : { status: body.status }), ...(body.priority === undefined ? {} : { priority: body.priority }) } });
    await this.prisma.auditLog.create({ data: { actorId: session.sub, action: 'PROVIDER_UPDATED', targetType: 'provider', targetId: provider.id, metaJson: { code, status: provider.status, priority: provider.priority } } });
    return { code: provider.code, status: provider.status, priority: provider.priority };
  }
}
