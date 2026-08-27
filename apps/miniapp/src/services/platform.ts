const platformRules = [
  ['doubao', /(^|\.)doubao\.com/i], ['douyin', /(^|\.)douyin\.com/i],
  ['xhs', /(^|\.)(xiaohongshu\.com|xhslink\.com)/i], ['qianwen', /(^|\.)qianwen\.com/i], ['wechat_channels', /(^|\.)(channels\.weixin\.qq\.com|weixin\.qq\.com)/i], ['jimeng', /(^|\.)(jimeng\.jianying\.com|jimeng\.com)/i], ['kuaishou', /(^|\.)(kuaishou\.com|chenzhongtech\.com)/i],
] as const;
export function extractUrl(input: string) { return input.match(/https?:\/\/[^\s，。！？、]+/i)?.[0] ?? null; }
export function detectPlatform(input: string) { const url = extractUrl(input); if (!url) return null; try { const host = new URL(url).hostname; return platformRules.find(([, pattern]) => pattern.test(host))?.[0] ?? 'generic'; } catch { return null; } }
export const platformNames: Record<string, string> = { doubao: '豆包', douyin: '抖音', xhs: '小红书', qianwen: '千问', wechat_channels: '微信视频号', jimeng: '即梦', kuaishou: '快手', generic: '分享链接' };
