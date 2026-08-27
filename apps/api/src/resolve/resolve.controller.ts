import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentSession, Session, SessionGuard } from '../auth/auth';
import { ResolveService } from './resolve.service';

@Controller('api/resolve') @UseGuards(SessionGuard)
export class ResolveController {
  constructor(private readonly resolve: ResolveService) {}
  @Post() submit(@CurrentSession() session: Session, @Body() body: { input: string; idempotencyKey?: string }) { return this.resolve.submit(session.tenantId!, session.sub, body.input, body.idempotencyKey); }
  @Get(':id') get(@CurrentSession() session: Session, @Param('id') id: string) { return this.resolve.getJob(session.tenantId!, session.sub, id); }
}

