import { Controller, ForbiddenException, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { ensureResolvedPublicHost, open, verifyMedia } from '../common/security';
import { PrismaService } from '../prisma/prisma.service';
import { MediaCompatibilityService } from './media-compatibility.service';

@Controller('api/media')
export class MediaController {
  constructor(private readonly prisma: PrismaService, private readonly compatibility: MediaCompatibilityService) {}
  @Get(':id')
  async proxy(@Param('id') id: string, @Query('expires') expires: string, @Query('sig') signature: string, @Query('format') format: string | undefined, @Req() request: Request, @Res() response: Response) {
    const expiry = Number(expires); if (!Number.isSafeInteger(expiry) || expiry < Date.now()) throw new ForbiddenException('MEDIA_TOKEN_EXPIRED');
    const media = await this.prisma.resolveMedia.findFirst({ where: { id, job: { status: 'SUCCESS' } }, include: { job: { select: { userId: true, tenantId: true } } } }); if (!media) throw new ForbiddenException('MEDIA_NOT_FOUND');
    // A native <video> request cannot carry the app's Authorization header. The
    // short-lived HMAC therefore acts as this endpoint's scoped read credential.
    const secret = process.env.MEDIA_PROXY_SIGNING_KEY || 'development-only-change-me'; verifyMedia(`${id}:${media.job.userId}:${media.job.tenantId}:${expiry}`, signature, secret);
    const sourceUrl = open(media.sourceUrlEnc, secret); await ensureResolvedPublicHost(sourceUrl);
    const closeBrokenStream = () => { if (!response.headersSent) response.status(502); response.destroy(); };
    if (format === 'h264' && media.type === 'VIDEO') { const compatible = await this.compatibility.h264(media.id, sourceUrl); const stream = await this.compatibility.stream(compatible.path, response, request.headers.range); stream.on('error', closeBrokenStream).pipe(response); return; }
    const upstream = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(20_000) }); if (!upstream.ok || !upstream.body) throw new ForbiddenException('MEDIA_UNAVAILABLE');
    const contentLength = Number(upstream.headers.get('content-length') || 0); const maxBytes = Number(process.env.MEDIA_PROXY_MAX_BYTES || 52_428_800); const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if ((contentLength && contentLength > maxBytes) || !/^(video|image)\//.test(contentType)) throw new ForbiddenException('MEDIA_POLICY_REJECTED');
    response.setHeader('content-type', contentType); if (contentLength) response.setHeader('content-length', contentLength); response.setHeader('cache-control', 'private, max-age=600'); Readable.fromWeb(upstream.body as never).on('error', closeBrokenStream).pipe(response);
  }
}
