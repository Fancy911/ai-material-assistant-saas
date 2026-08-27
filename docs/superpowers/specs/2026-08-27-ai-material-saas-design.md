# AI 素材助手 SaaS：P0 实施设计

## 目标与边界

实现 PRD v1.1 定义的可运行 P0：多租户链接素材提取服务，覆盖用户端、Tenant Admin、Super Admin、双额度账本、兑换码、Provider Gateway、Media Proxy 与安全隔离。产品范围严格限制于 PRD P0；所有扩展功能进入 `BACKLOG.md`。

真实残像 Token 与微信凭证不在当前环境，因此 Provider 的真实四平台烟测、微信真实登录与生产域名下载将列为 BLOCKED；实现必须提供服务器端环境变量、完整 CanxiangProvider 和可运行 MockProvider，确保其余功能可完整验证。

## 工程边界

采用 pnpm workspace：

- `apps/api`：NestJS + Prisma + PostgreSQL，承载认证、租户作用域、解析、账本、后台 API、Media Proxy。
- `apps/miniapp`：uni-app Vue 3 + TypeScript，支持 H5 / 微信小程序构建。
- `apps/tenant-admin`、`apps/super-admin`：Vue 3 / Vite / Element Plus。
- `packages/contracts`：共享 DTO、枚举、ResolveResult 与平台识别规则。

本地开发使用 PostgreSQL；Mock 模式不替换正式数据库。Seed 提供一个 Super Admin、两个可验证隔离的 Tenant、各自管理员及测试用户。

## 核心数据与权限设计

所有租户业务表直接保存 `tenant_id`。任何 Tenant Admin 查询由服务端从登录态得出租户范围，永不接受客户端指定的租户身份。Super Admin 与 Tenant Admin 使用独立角色守卫。

`points_ledger` 和 `quota_ledger` 是两本独立账。解析成功且至少有一条有效 media 后，在一个数据库事务内更新 user points、tenant quota、两本 ledger、job 和媒体记录；失败、超时、能力禁用或无媒体均不扣费。并发使用原子条件更新和 60 秒的 user+normalized-url 去重，保证不超扣与不重复扣。

兑换码仅以哈希存储，绑定 tenant；兑换在事务中执行并以状态转换保证幂等。敏感操作写入 audit log。

## 解析与媒体流程

用户提交文本或 URL 后，后端提取并标准化 allowlist 内的 URL，识别平台并检查租户状态、到期时间、平台 capability、用户状态、点数及额度。Resolver Gateway 仅依赖统一 `ResolveResult`；CanxiangProvider 适配真实上游，MockProvider 只用于显式 Mock 模式。

成功结果中的原始媒体地址仅在服务端加密持久化。Media Proxy 通过 job、media、过期时间和 HMAC 令牌授权，验证当前用户与 tenant，并且仅访问已入库且由 Resolver 写入的 URL；再执行协议、host、DNS/IP、响应大小和 MIME 类型限制，拒绝 localhost、内网与 metadata 地址。

## 页面与接口

用户端按照 PRD 的三 Tab：极简首页（四个平台、粘贴/自动识别/提取）、记录、我的（点数、兑换码、意向付费）。结果页按 video/image/gallery 展示和保存。

Tenant Admin 提供概览、用户和点数调整、兑换码、解析记录、额度、基础配置；Super Admin 提供租户、能力与额度、Provider/Secret 掩码、调用日志、成功率和成本统计。业务错误统一为 `{ code, message, requestId }`。

## 验证策略与交付

按 DEV-00 至 DEV-09 实施。每阶段执行 build、lint、typecheck、自动测试并更新开发记录。测试覆盖租户隔离、双账本、失败不扣、幂等、兑换码、到期/停用/能力、额度、超时、非法 URL/SSRF、代理令牌与并发。

最终交付 README、`.env.example`、迁移、Seed、测试账号、Mock/Canxiang Provider、运行说明、测试报告、BACKLOG、FINAL-REPORT 和真实凭证待办。AC 结果只能报告实际通过项；无 Token 的四平台真实验收不得标为 PASS。
