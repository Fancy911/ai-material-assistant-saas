import { rateLimit } from './rate-limit';

describe('rate limit', () => {
  it('limits repeated admin login attempts', () => {
    const next = jest.fn(); const response = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    for (let index = 0; index < 12; index += 1) rateLimit({ path: '/api/auth/admin-login', ip: '203.0.113.9', headers: {}, socket: {} } as any, response, next);
    rateLimit({ path: '/api/auth/admin-login', ip: '203.0.113.9', headers: {}, socket: {} } as any, response, next);
    expect(next).toHaveBeenCalledTimes(12); expect(response.status).toHaveBeenCalledWith(429);
  });
});
