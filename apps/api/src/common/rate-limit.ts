import type { NextFunction, Request, Response } from 'express';

type Rule = { pattern: RegExp; max: number; windowMs: number; name: string };
const rules: Rule[] = [
  { pattern: /^\/api\/auth\/(wechat-login|admin-login)$/, max: 12, windowMs: 60_000, name: 'auth' },
  { pattern: /^\/api\/resolve$/, max: 24, windowMs: 60_000, name: 'resolve' },
  { pattern: /^\/api\/redeem$/, max: 12, windowMs: 60_000, name: 'redeem' },
  { pattern: /^\/api\/media\//, max: 80, windowMs: 60_000, name: 'media' },
];
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(request: Request, response: Response, next: NextFunction) {
  const rule = rules.find((value) => value.pattern.test(request.path)); if (!rule) return next();
  const ip = request.ip || request.socket.remoteAddress || 'unknown'; const session = request.headers.authorization?.slice(0, 40) || 'anon'; const key = `${rule.name}:${ip}:${session}`; const now = Date.now(); const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + rule.windowMs }); return next(); }
  if (current.count >= rule.max) { response.setHeader('retry-after', Math.ceil((current.resetAt - now) / 1000)); response.status(429).json({ statusCode: 429, message: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' }); return; }
  current.count += 1; next();
}
