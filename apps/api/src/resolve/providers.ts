import { Injectable } from '@nestjs/common';
import { ensureSafeMediaUrl } from '../common/security';

type ResolveResult = { success: boolean; platform: 'doubao' | 'douyin' | 'xhs' | 'qianwen'; mediaType: 'video' | 'image' | 'gallery' | null; title: string | null; author: string | null; coverUrl: string | null; media: { type: 'video' | 'image'; sourceUrl: string; mimeType: string | null; width: number | null; height: number | null; sizeBytes: number | null }[]; durationSec: number | null; provider: string; rawCode: string | null; errorCode: string | null };

export const platformHosts: Record<string, string[]> = { doubao: ['doubao.com'], douyin: ['douyin.com'], xhs: ['xiaohongshu.com', 'xhslink.com'], qianwen: ['qianwen.com'] };
export function extractSupportedUrl(input: string) { const matches = input.match(/https?:\/\/[^\s，。！？、]+/gi) ?? []; for (const candidate of matches) { try { const url = new URL(candidate); const platform = Object.entries(platformHosts).find(([, hosts]) => hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)))?.[0]; if (platform) return { url: url.toString(), platform }; } catch { /* continue */ } } return null; }
export interface ResolverProvider { resolve(platform: string, url: string): Promise<ResolveResult>; }
@Injectable()
export class MockProvider implements ResolverProvider {
  async resolve(platform: string, url: string): Promise<ResolveResult> { return { success: true, platform: platform as ResolveResult['platform'], mediaType: 'video', title: `Mock ${platform} material`, author: null, coverUrl: 'https://images.unsplash.com/photo-1492724441997-5dc865305da7', media: [{ type: 'video', sourceUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4', mimeType: 'video/mp4', width: 1280, height: 720, sizeBytes: null }], durationSec: 52, provider: 'mock', rawCode: 'MOCK_OK', errorCode: null }; }
}
@Injectable()
export class CanxiangProvider implements ResolverProvider {
  async resolve(platform: string, url: string): Promise<ResolveResult> {
    const token = process.env.CANXIANG_TOKEN; if (!token) throw new Error('PROVIDER_AUTH_ERROR');
    const paths: Record<string, string> = { doubao: '/api/doubaovideo', douyin: '/api/douyin', xhs: '/api/xhs', qianwen: '/api/qw' };
    const started = Date.now(); const response = await fetch(`${(process.env.CANXIANG_BASE_URL || 'https://api.cxzja.cn').replace(/\/$/, '')}${paths[platform]}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(Number(process.env.CANXIANG_TIMEOUT_MS || 12000)) });
    const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
    const candidate = Array.isArray(raw.data) ? raw.data : Array.isArray(raw.media) ? raw.media : [raw.data ?? raw.url ?? raw.video_url].filter(Boolean);
    const media = candidate.flatMap((entry) => { const sourceUrl = typeof entry === 'string' ? entry : (entry as Record<string, unknown>)?.url ?? (entry as Record<string, unknown>)?.play_url; return typeof sourceUrl === 'string' ? [{ type: sourceUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) ? 'image' as const : 'video' as const, sourceUrl, mimeType: null, width: null, height: null, sizeBytes: null }] : []; }).filter((item) => { try { ensureSafeMediaUrl(item.sourceUrl); return true; } catch { return false; } });
    if (!response.ok || !media.length) return { success: false, platform: platform as ResolveResult['platform'], mediaType: null, title: null, author: null, coverUrl: null, media: [], durationSec: null, provider: 'canxiang', rawCode: String(response.status), errorCode: response.status === 401 ? 'PROVIDER_AUTH_ERROR' : 'MEDIA_NOT_FOUND' };
    return { success: true, platform: platform as ResolveResult['platform'], mediaType: media.length > 1 ? 'gallery' : media[0].type, title: typeof raw.title === 'string' ? raw.title : null, author: null, coverUrl: null, media, durationSec: null, provider: 'canxiang', rawCode: String(response.status), errorCode: null };
  }
}
@Injectable()
export class ZhilingProvider implements ResolverProvider {
  async resolve(platform: string, url: string): Promise<ResolveResult> {
    // The vendor's private endpoint and response schema are configured only after account activation.
    // Keeping this explicit prevents sending user links to an invented or unverified endpoint.
    if (!process.env.ZHILING_API_KEY || !process.env.ZHILING_API_BASE_URL) throw new Error('PROVIDER_NOT_CONFIGURED');
    throw new Error('PROVIDER_INTEGRATION_PENDING');
  }
}
