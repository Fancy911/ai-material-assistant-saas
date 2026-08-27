# 开发记录

## 2026-08-27

- DEV-00：完成 Canxiang 四平台真实烟测脚本和脱敏报告；因没有 Token/真实样本，四项真实烟测为 BLOCKED。
- DEV-01～03：初始化 pnpm workspace、NestJS API 与 Prisma PostgreSQL schema；实现多租户模型、Seed、平台识别、Provider Gateway、60 秒请求复用、条件扣点/扣额度与账本事务。
- 本地 Docker 服务未运行，不能在当前环境执行数据库迁移/Seed；该项及 DB 集成测试待 Docker daemon 可用时执行。

