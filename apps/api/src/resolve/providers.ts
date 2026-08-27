import { Injectable } from '@nestjs/common';
import { ensureSafeMediaUrl } from '../common/security';

type ResolveResult = { success: boolean; platform: string; mediaType: 'video' | 'image' | 'gallery' | null; title: string | null; author: string | null; coverUrl: string | null; media: { type: 'video' | 'image'; sourceUrl: string; mimeType: string | null; width: number | null; height: number | null; sizeBytes: number | null }[]; durationSec: number | null; provider: string; rawCode: string | null; errorCode: string | null };

export const platformHosts: Record<string, string[]> = { doubao: ['doubao.com'], douyin: ['douyin.com'], xhs: ['xiaohongshu.com', 'xhslink.com'], qianwen: ['qianwen.com'], wechat_channels: ['channels.weixin.qq.com', 'weixin.qq.com'], jimeng: ['jimeng.jianying.com', 'jimeng.com'], kuaishou: ['kuaishou.com', 'chenzhongtech.com'], bilibili: ['bilibili.com', 'b23.tv'], xigua: ['ixigua.com', 'xigua.com'], weibo: ['weibo.com', 'weibo.cn'], haokan: ['haokan.baidu.com'], huoshan: ['huoshan.com'], pipix: ['pipix.com'], zuiyou: ['zuiyou.com'] };
export function extractSupportedUrl(input: string) { const matches = input.match(/https?:\/\/[^\s，。！？、]+/gi) ?? []; for (const candidate of matches) { try { const url = new URL(candidate); if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) continue; const platform = Object.entries(platformHosts).find(([, hosts]) => hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)))?.[0] ?? 'generic'; return { url: url.toString(), platform }; } catch { /* continue */ } } return null; }
export interface ResolverProvider { resolve(platform: string, url: string): Promise<ResolveResult>; }
@Injectable()
export class MockProvider implements ResolverProvider {
  async resolve(platform: string, url: string): Promise<ResolveResult> { return { success: true, platform, mediaType: 'video', title: `Mock ${platform} material`, author: null, coverUrl: 'https://images.unsplash.com/photo-1492724441997-5dc865305da7', media: [{ type: 'video', sourceUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4', mimeType: 'video/mp4', width: 1280, height: 720, sizeBytes: null }], durationSec: 52, provider: 'mock', rawCode: 'MOCK_OK', errorCode: null }; }
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
    if (!response.ok || !media.length) return { success: false, platform, mediaType: null, title: null, author: null, coverUrl: null, media: [], durationSec: null, provider: 'canxiang', rawCode: String(response.status), errorCode: response.status === 401 ? 'PROVIDER_AUTH_ERROR' : 'MEDIA_NOT_FOUND' };
    return { success: true, platform, mediaType: media.length > 1 ? 'gallery' : media[0].type, title: typeof raw.title === 'string' ? raw.title : null, author: null, coverUrl: null, media, durationSec: null, provider: 'canxiang', rawCode: String(response.status), errorCode: null };
  }
}
@Injectable()
export class ZhilingProvider implements ResolverProvider {
  async resolve(platform: string, url: string): Promise<ResolveResult> {
    const key = process.env.ZHILING_API_KEY; if (!key) throw new Error('PROVIDER_NOT_CONFIGURED');
    const configuredEndpoint = process.env.ZHILING_API_BASE_URL?.trim() || 'https://api.17zhiling.com/api/video/parse-video-url-times';
    const endpoint = configuredEndpoint.includes('/api/') ? configuredEndpoint : `${configuredEndpoint.replace(/\/$/, '')}/api/video/parse-video-url-times`;
    const requestUrl = new URL(endpoint); requestUrl.searchParams.set('key', key); requestUrl.searchParams.set('url', url);
    const response = await fetch(requestUrl, { method: 'GET', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(Number(process.env.ZHILING_TIMEOUT_MS || 12000)) });
    const raw = await response.json().catch(() => ({})) as { code?: number; msg?: string; data?: { url?: unknown; videosList?: unknown; title?: unknown; authorName?: unknown; photo?: unknown; picsList?: unknown } };
    const data = raw.data || {}; const videos = [data.url, ...(Array.isArray(data.videosList) ? data.videosList : [])]; const images = Array.isArray(data.picsList) ? data.picsList : [];
    const toMedia = (value: unknown, type: 'video' | 'image') => typeof value === 'string' ? (() => { try { ensureSafeMediaUrl(value); return { type, sourceUrl: value, mimeType: null, width: null, height: null, sizeBytes: null }; } catch { return null; } })() : null;
    const media = [...videos.map((value) => toMedia(value, 'video')), ...images.map((value) => toMedia(value, 'image'))].filter((item): item is NonNullable<typeof item> => item !== null);
    const success = response.ok && raw.code === 200 && media.length > 0;
    return { success, platform, mediaType: !media.length ? null : media.length > 1 ? 'gallery' : media[0].type, title: typeof data.title === 'string' ? data.title : null, author: typeof data.authorName === 'string' ? data.authorName : null, coverUrl: typeof data.photo === 'string' ? data.photo : null, media, durationSec: null, provider: 'zhiling', rawCode: String(raw.code ?? response.status), errorCode: success ? null : raw.code === -1 ? 'PROVIDER_REJECTED' : response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_ERROR' : 'MEDIA_NOT_FOUND' };
  }
}
