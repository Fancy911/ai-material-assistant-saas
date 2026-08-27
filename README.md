# AI 素材助手 SaaS

面向多租户运营的链接素材提取 SaaS。P0 支持豆包、抖音、小红书和千问分享链接的自动识别、素材提取、点数体系、租户额度、兑换码、运营后台与平台总端。

> 仅处理用户有权使用的公开分享链接；上线及商业化前须确认上游 Provider 的商业授权与所在地合规要求。

## 项目状态

正在按 PRD v1.1 执行 DEV-00 → DEV-09：先完成 CanxiangProvider 的四平台验证，再交付正式多租户 MVP。

## 文档

- `AI素材助手SaaS-完整PRD-v1.1.docx`：产品与验收基线
- `docs/superpowers/specs/2026-08-27-ai-material-saas-design.md`：实施设计

## 计划技术栈

- pnpm monorepo
- NestJS + Prisma + PostgreSQL
- uni-app（Vue 3 / TypeScript）
- Vue 3 + Vite + Element Plus 管理端

## 安全承诺

任何 Token、AppSecret、JWT 密钥和媒体代理签名密钥只存在于服务端环境变量，永不提交到仓库或打包进前端。

## 本地运行

1. 安装并打开 Docker Desktop。
2. 执行 `docker compose -p ai_material up -d postgres` 启动 PostgreSQL。
3. 复制 `.env.example` 为本地 `.env`，设置本地随机密钥；不要提交这个文件。
4. 执行 `pnpm db:migrate`、`pnpm db:seed`，然后执行 `pnpm dev:api`。
5. 访问 `http://localhost:3000/health`，应返回 `{"status":"ok"}`。

Seed 测试密码是 `ChangeMe_2026!`；仅限本地开发，部署前必须修改。总管理员账号为 `superadmin`，租户管理员为 `tenant-a-admin` / `tenant-b-admin`。

本地 Seed 兑换码为 `WELCOME10`（仅演示租户 A，一次性 10 点）；生产环境必须通过 Tenant Admin 批量生成，不应保留这个测试码。

### 残像 Token

在残像后台**新建或轮换** Token 后，只在本机根目录 `.env` 设定 `CANXIANG_TOKEN`，将 `RESOLVER_MODE` 改成 `canxiang`，并在同一安全环境填写四个 `CANXIANG_SAMPLE_*` 测试链接。随后运行 `pnpm smoke:canxiang`。Token 不要发到聊天、不要写进 README、不要提交到 Git。
