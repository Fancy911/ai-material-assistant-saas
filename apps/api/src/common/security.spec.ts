import { isUnsafeHost, ensureSafeMediaUrl, signMedia, verifyMedia } from './security';
describe('media proxy defenses', () => {
  it.each(['localhost', '127.0.0.1', '169.254.169.254', '10.0.0.1', '192.168.1.1'])('rejects unsafe host %s', (host) => expect(isUnsafeHost(host)).toBe(true));
  it('rejects a local proxy target', () => expect(() => ensureSafeMediaUrl('http://127.0.0.1/internal')).toThrow());
  it('requires a valid signed payload', () => { const payload = 'job.media.1'; const sig = signMedia(payload, 'secret'); expect(() => verifyMedia(payload, sig, 'secret')).not.toThrow(); expect(() => verifyMedia(`${payload}x`, sig, 'secret')).toThrow(); });
});

