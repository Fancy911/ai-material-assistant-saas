import { Controller, ForbiddenException, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { CurrentSession, Session, SessionGuard } from '../auth/auth';
import { ensureResolvedPublicHost, open, verifyMedia } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/media') @UseGuards(SessionGuard)
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(':id')
  async proxy(@CurrentSession() session: Session, @Param('id') id: string, @Query('expires') expires: string, @Query('sig') signature: string, @Res() response: Response) {
    const expiry = Number(expires); if (!Number.isSafeInteger(expiry) || expiry < Date.now()) throw new ForbiddenException('MEDIA_TOKEN_EXPIRED');
    const secret = process.env.MEDIA_PROXY_SIGNING_KEY || 'development-only-change-me'; verifyMedia(`${id}:${session.sub}:${session.tenantId}:${expiry}`, signature, secret);
    const media = await this.prisma.resolveMedia.findFirst({ where: { id, job: { userId: session.sub, tenantId: session.tenantId, status: 'SUCCESS' } } }); if (!media) throw new ForbiddenException('MEDIA_NOT_FOUND');
    const sourceUrl = open(media.sourceUrlEnc, secret); await ensureResolvedPublicHost(sourceUrl);
    const upstream = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(20_000) }); if (!upstream.ok || !upstream.body) throw new ForbiddenException('MEDIA_UNAVAILABLE');
    const contentLength = Number(upstream.headers.get('content-length') || 0); const maxBytes = Number(process.env.MEDIA_PROXY_MAX_BYTES || 52_428_800); const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if ((contentLength && contentLength > maxBytes) || !/^(video|image)\//.test(contentType)) throw new ForbiddenException('MEDIA_POLICY_REJECTED');
    response.setHeader('content-type', contentType); if (contentLength) response.setHeader('content-length', contentLength); response.setHeader('cache-control', 'private, max-age=600'); Readable.fromWeb(upstream.body as never).pipe(response);
  }
}
