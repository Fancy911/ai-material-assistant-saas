import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const privateIpv4 = (ip: string) => /^127\.|^10\.|^0\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
export const isUnsafeHost = (hostname: string) => hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'metadata.google.internal' || (isIP(hostname) === 4 && privateIpv4(hostname)) || (isIP(hostname) === 6 && (hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')));
export function ensureSafeMediaUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new BadRequestException('Invalid media URL'); }
  if (url.protocol !== 'https:' || isUnsafeHost(url.hostname)) throw new BadRequestException('Unsafe media URL');
  return url;
}
export function urlHash(url: string) { return createHash('sha256').update(url).digest('hex'); }
const key = (secret: string) => createHash('sha256').update(secret).digest();
export function seal(value: string, secret: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(secret), iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url'); }
export function open(value: string, secret: string) { const data = Buffer.from(value, 'base64url'); const decipher = createDecipheriv('aes-256-gcm', key(secret), data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'); }
export function signMedia(payload: string, secret: string) { return createHmac('sha256', secret).update(payload).digest('base64url'); }
export function verifyMedia(payload: string, signature: string, secret: string) { const expected = signMedia(payload, secret); if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new ForbiddenException('Invalid media token'); }

