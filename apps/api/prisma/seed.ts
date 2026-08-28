import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
const prisma = new PrismaClient();
async function main() {
  const passwordHash = await argon2.hash('ChangeMe_2026!');
  const tenantA = await prisma.tenant.upsert({ where: { id: 'tenant-demo-a' }, update: {}, create: { id: 'tenant-demo-a', name: '演示租户 A', quotaTotal: 1000, quotaRemaining: 1000 } });
  const tenantB = await prisma.tenant.upsert({ where: { id: 'tenant-demo-b' }, update: {}, create: { id: 'tenant-demo-b', name: '隔离验证租户 B', quotaTotal: 1000, quotaRemaining: 1000 } });
  const enabledCapabilities = ['doubao', 'douyin', 'xhs', 'qianwen', 'wechat_channels', 'jimeng', 'kuaishou', 'bilibili', 'xigua', 'weibo', 'haokan', 'huoshan', 'pipix', 'zuiyou', 'generic'];
  for (const tenant of [tenantA, tenantB]) { for (const capability of enabledCapabilities) await prisma.tenantCapability.upsert({ where: { tenantId_capability: { tenantId: tenant.id, capability } }, update: {}, create: { tenantId: tenant.id, capability, enabled: true } }); await prisma.tenantSetting.upsert({ where: { tenantId: tenant.id }, update: {}, create: { tenantId: tenant.id, initialPoints: 10, pointCost: 1 } }); }
  await prisma.tenantAdmin.upsert({ where: { account: 'superadmin' }, update: { passwordHash }, create: { account: 'superadmin', passwordHash, role: 'SUPER_ADMIN' } });
  await prisma.tenantAdmin.upsert({ where: { account: 'tenant-a-admin' }, update: { passwordHash }, create: { account: 'tenant-a-admin', passwordHash, role: 'TENANT_ADMIN', tenantId: tenantA.id } });
  await prisma.tenantAdmin.upsert({ where: { account: 'tenant-b-admin' }, update: { passwordHash }, create: { account: 'tenant-b-admin', passwordHash, role: 'TENANT_ADMIN', tenantId: tenantB.id } });
  await prisma.user.upsert({ where: { tenantId_openid: { tenantId: tenantA.id, openid: 'mock-user-a' } }, update: {}, create: { tenantId: tenantA.id, openid: 'mock-user-a', pointsBalance: 10 } });
  await prisma.user.upsert({ where: { tenantId_openid: { tenantId: tenantB.id, openid: 'mock-user-b' } }, update: {}, create: { tenantId: tenantB.id, openid: 'mock-user-b', pointsBalance: 10 } });
  await prisma.provider.upsert({ where: { code: 'canxiang' }, update: { priority: 20 }, create: { code: 'canxiang', name: 'Canxiang API', baseUrl: 'https://api.cxzja.cn', priority: 20, costConfig: { doubao: 0.001, douyin: 0, xhs: 0, qianwen: 0 } } });
  await prisma.provider.upsert({ where: { code: 'zhiling' }, update: { priority: 1, baseUrl: 'https://api.17zhiling.com/api/video/parse-video-url-times' }, create: { code: 'zhiling', name: 'Zhiling API', baseUrl: 'https://api.17zhiling.com/api/video/parse-video-url-times', status: 'DISABLED', priority: 1, costConfig: { pricePerCall: 0.01, includedCalls: 30 } } });
  const testCode = 'WELCOME10'; const codeHash = createHash('sha256').update(testCode).digest('hex');
  await prisma.redeemCode.upsert({ where: { codeHash }, update: {}, create: { tenantId: tenantA.id, codeHash, codeHint: 'WELCOME••10', points: 10 } });
}
main().finally(() => prisma.$disconnect());
