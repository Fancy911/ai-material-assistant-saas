import { extractSupportedUrl } from './providers';
describe('platform detection', () => {
  it('extracts a supported URL from share copy', () => expect(extractSupportedUrl('复制此链接 https://v.douyin.com/abc/ 看视频')).toMatchObject({ platform: 'douyin' }));
  it('rejects unsupported URLs before provider selection', () => expect(extractSupportedUrl('https://example.com/a')).toBeNull());
});

