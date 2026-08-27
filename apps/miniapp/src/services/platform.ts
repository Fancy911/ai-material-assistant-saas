const platformRules = [
  ['doubao', /(^|\.)doubao\.com/i], ['douyin', /(^|\.)douyin\.com/i],
  ['xhs', /(^|\.)(xiaohongshu\.com|xhslink\.com)/i], ['qianwen', /(^|\.)qianwen\.com/i],
] as const;
export function extractUrl(input: string) { return input.match(/https?:\/\/[^\s，。！？、]+/i)?.[0] ?? null; }
export function detectPlatform(input: string) { const url = extractUrl(input); if (!url) return null; try { const host = new URL(url).hostname; return platformRules.find(([, pattern]) => pattern.test(host))?.[0] ?? null; } catch { return null; } }
export const platformNames: Record<string, string> = { doubao: '豆包', douyin: '抖音', xhs: '小红书', qianwen: '千问' };

