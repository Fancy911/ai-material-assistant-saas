const buildEnv = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env;
const baseUrl = buildEnv?.VITE_API_BASE_URL || 'http://127.0.0.1:3000';
type ApiError = { message?: string; code?: string; statusCode?: number };
function rawRequest<T>(path: string, method: 'GET' | 'POST' = 'GET', data?: Record<string, unknown>): Promise<T> {
  const token = uni.getStorageSync('access_token') as string | undefined;
  return new Promise((resolve, reject) => uni.request({ url: `${baseUrl}${path}`, method, data, header: token ? { Authorization: `Bearer ${token}` } : {}, success: ({ statusCode, data: body }) => { if (statusCode >= 200 && statusCode < 300) resolve(body as T); else reject({ ...(typeof body === 'object' && body ? body : {}), statusCode } as ApiError); }, fail: reject }));
}
async function request<T>(path: string, method: 'GET' | 'POST' = 'GET', data?: Record<string, unknown>, retrySession = true): Promise<T> {
  try { return await rawRequest<T>(path, method, data); } catch (error) { if (retrySession && path !== '/api/auth/wechat-login' && (error as ApiError).statusCode === 401) { uni.removeStorageSync('access_token'); await ensureSession(true); return rawRequest<T>(path, method, data); } throw error; }
}
export async function ensureSession(force = false) {
  const existing = uni.getStorageSync('access_token'); if (existing && !force) return existing as string;
  const code = await new Promise<string>((resolve) => uni.login({ provider: 'weixin', success: ({ code }) => resolve(code || `h5-${Date.now()}`), fail: () => resolve(`h5-${Date.now()}`) }));
  const result = await request<{ accessToken: string }>('/api/auth/wechat-login', 'POST', { code }, false); uni.setStorageSync('access_token', result.accessToken); return result.accessToken;
}
export async function resolveMaterial(input: string) { await ensureSession(); return request<{ id: string; platform: string; status: string }>('/api/resolve', 'POST', { input, idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}` }); }
export async function getJob(id: string) { await ensureSession(); return request<{ id: string; platform: string; status: string; title: string | null; mediaType: string | null; media: { id: string; type: string; proxyUrl: string; metaJson: Record<string, unknown> | null }[] }>(`/api/resolve/${id}`); }
export async function getMe() { await ensureSession(); return request<{ pointsBalance: number; totalResolves: number; miniappName: string }>('/api/me'); }
export async function getHistory() { await ensureSession(); return request<{ id: string; platform: string; status: string; mediaType: string | null; title: string | null; createdAt: string }[]>('/api/me/history'); }
export async function redeemCode(code: string) { await ensureSession(); return request<{ pointsAdded: number; pointsBalance: number }>('/api/redeem', 'POST', { code }); }
export async function recordPaywallIntent(packageSelected: string) { await ensureSession(); return request<{ recorded: boolean }>('/api/paywall-intent', 'POST', { packageSelected }); }
