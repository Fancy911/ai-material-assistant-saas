# 开发记录

## 2026-08-27

- DEV-00：完成 Canxiang 四平台真实烟测脚本和脱敏报告；因没有 Token/真实样本，四项真实烟测为 BLOCKED。
- DEV-01～03：初始化 pnpm workspace、NestJS API 与 Prisma PostgreSQL schema；实现多租户模型、Seed、平台识别、Provider Gateway、60 秒请求复用、条件扣点/扣额度与账本事务。
- Docker Desktop 已启动；PostgreSQL 容器健康检查通过，migration 已实际应用，Seed 已成功执行，API 健康检查返回 `{"status":"ok"}`。
