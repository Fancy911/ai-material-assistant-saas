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

