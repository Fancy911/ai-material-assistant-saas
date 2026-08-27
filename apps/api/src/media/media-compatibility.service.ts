import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { spawn } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

type CompatibleMedia = { path: string; size: number };

@Injectable()
export class MediaCompatibilityService {
  private readonly inFlight = new Map<string, Promise<CompatibleMedia>>();

  async h264(mediaId: string, sourceUrl: string): Promise<CompatibleMedia> {
    const key = mediaId.replace(/[^a-zA-Z0-9_-]/g, ''); const running = this.inFlight.get(key); if (running) return running;
    const task = this.createCompatibleFile(key, sourceUrl).finally(() => this.inFlight.delete(key)); this.inFlight.set(key, task); return task;
  }

  async stream(path: string, response: { setHeader(name: string, value: string | number): unknown; status(code: number): unknown }, range?: string) {
    const stat = await fs.stat(path); const match = range?.match(/^bytes=(\d*)-(\d*)$/); const start = match?.[1] ? Number(match[1]) : 0; const end = match?.[2] ? Number(match[2]) : stat.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= stat.size) throw new ForbiddenException('MEDIA_RANGE_INVALID');
    const partial = Boolean(match); const length = end - start + 1;
    response.setHeader('content-type', 'video/mp4'); response.setHeader('accept-ranges', 'bytes'); response.setHeader('content-length', length); response.setHeader('cache-control', 'private, max-age=600');
    if (partial) { response.status(206); response.setHeader('content-range', `bytes ${start}-${end}/${stat.size}`); }
    return createReadStream(path, { start, end });
  }

  private async createCompatibleFile(mediaId: string, sourceUrl: string): Promise<CompatibleMedia> {
    const directory = process.env.MEDIA_COMPAT_CACHE_DIR || '/tmp/ai-material-compat'; const ttlMs = Number(process.env.MEDIA_COMPAT_CACHE_TTL_SECONDS || 3600) * 1000;
    await fs.mkdir(directory, { recursive: true }); await this.cleanup(directory, ttlMs);
    const output = join(directory, `${mediaId}.mp4`); const cached = await fs.stat(output).catch(() => null); if (cached && Date.now() - cached.mtimeMs < ttlMs && cached.size > 0) return { path: output, size: cached.size };
    const input = join(directory, `${mediaId}-${Date.now()}.source`); const temporary = join(directory, `${mediaId}-${Date.now()}.tmp.mp4`);
    try {
      await this.downloadVideo(sourceUrl, input); const codec = await this.videoCodec(input);
      const videoArgs = codec === 'h264' ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', process.env.MEDIA_COMPAT_PRESET || 'veryfast', '-crf', process.env.MEDIA_COMPAT_CRF || '22', '-pix_fmt', 'yuv420p'];
      await this.run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:v:0?', '-map', '0:a:0?', ...videoArgs, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', temporary]);
      await fs.rename(temporary, output); const stat = await fs.stat(output); if (!stat.size) throw new Error('EMPTY_COMPAT_MEDIA'); return { path: output, size: stat.size };
    } catch (error) { if (error instanceof ForbiddenException) throw error; throw new ServiceUnavailableException('MEDIA_COMPATIBILITY_FAILED'); }
    finally { await Promise.all([fs.rm(input, { force: true }), fs.rm(temporary, { force: true })]); }
  }

  private async downloadVideo(sourceUrl: string, output: string) {
    const upstream = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(Number(process.env.MEDIA_PROXY_TIMEOUT_MS || 20_000)) }); if (!upstream.ok || !upstream.body) throw new ForbiddenException('MEDIA_UNAVAILABLE');
    const maxBytes = Number(process.env.MEDIA_PROXY_MAX_BYTES || 52_428_800); const contentLength = Number(upstream.headers.get('content-length') || 0); const contentType = upstream.headers.get('content-type') || '';
    if ((contentLength && contentLength > maxBytes) || !contentType.startsWith('video/')) throw new ForbiddenException('MEDIA_POLICY_REJECTED');
    let received = 0; const limiter = new Transform({ transform(chunk, _encoding, callback) { received += chunk.length; callback(received > maxBytes ? new Error('MEDIA_TOO_LARGE') : null, chunk); } }); await pipeline(Readable.fromWeb(upstream.body as never), limiter, createWriteStream(output, { flags: 'w' }));
  }

  private async videoCodec(path: string) { return (await this.run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'default=nokey=1:noprint_wrappers=1', path])).trim().toLowerCase(); }
  private run(command: string, args: string[]) { return new Promise<string>((resolve, reject) => { const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; let error = ''; const timeout = setTimeout(() => child.kill('SIGKILL'), Number(process.env.MEDIA_COMPAT_TIMEOUT_MS || 120_000)); child.stdout.on('data', (data) => { output += data.toString(); }); child.stderr.on('data', (data) => { error += data.toString(); }); child.on('error', reject); child.on('close', (code) => { clearTimeout(timeout); code === 0 ? resolve(output) : reject(new Error(`${command}:${code}:${error.slice(0, 300)}`)); }); }); }
  private async cleanup(directory: string, ttlMs: number) { const entries = await fs.readdir(directory).catch(() => []); const cutoff = Date.now() - ttlMs; await Promise.all(entries.map(async (entry) => { const path = join(directory, basename(entry)); const stat = await fs.stat(path).catch(() => null); if (stat && stat.mtimeMs < cutoff) await fs.rm(path, { force: true }); })); }
}
