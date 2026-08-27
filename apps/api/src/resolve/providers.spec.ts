import { extractSupportedUrl, ZhilingProvider } from './providers';
describe('platform detection', () => {
  it('extracts a supported URL from share copy', () => expect(extractSupportedUrl('复制此链接 https://v.douyin.com/abc/ 看视频')).toMatchObject({ platform: 'douyin' }));
  it('recognizes Video Accounts, Jimeng and Kuaishou links', () => {
    expect(extractSupportedUrl('https://channels.weixin.qq.com/x')).toMatchObject({ platform: 'wechat_channels' });
    expect(extractSupportedUrl('https://jimeng.jianying.com/x')).toMatchObject({ platform: 'jimeng' });
    expect(extractSupportedUrl('https://v.kuaishou.com/x')).toMatchObject({ platform: 'kuaishou' });
  });
  it('passes unlisted public links to the provider as generic', () => expect(extractSupportedUrl('https://example.com/a')).toMatchObject({ platform: 'generic' }));
});

describe('ZhilingProvider', () => {
  const originalFetch = global.fetch;
  const oldKey = process.env.ZHILING_API_KEY;
  const oldEndpoint = process.env.ZHILING_API_BASE_URL;
  beforeEach(() => { process.env.ZHILING_API_KEY = 'test-key'; process.env.ZHILING_API_BASE_URL = 'https://api.17zhiling.com/api/video/parse-video-url-times'; });
  afterEach(() => { global.fetch = originalFetch; process.env.ZHILING_API_KEY = oldKey; process.env.ZHILING_API_BASE_URL = oldEndpoint; });
  it('uses documented GET parameters and maps video, gallery and metadata', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 200, data: { title: '测试标题', authorName: '作者', photo: 'https://cdn.example.com/cover.jpg', videosList: ['https://cdn.example.com/a.mp4', 'https://cdn.example.com/b.mp4'] } }) });
    const result = await new ZhilingProvider().resolve('kuaishou', 'https://v.kuaishou.com/example');
    const requested = (global.fetch as jest.Mock).mock.calls[0][0] as URL;
    expect(requested.toString()).toContain('key=test-key');
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'GET' }));
    expect(result).toMatchObject({ success: true, provider: 'zhiling', platform: 'kuaishou', mediaType: 'gallery', title: '测试标题', author: '作者' });
    expect(result.media).toHaveLength(2);
  });
});
