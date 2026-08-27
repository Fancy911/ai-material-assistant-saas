# AI 素材助手 SaaS｜DEV-03～DEV-09 收口设计

## 目标与基线

以当前工程已验证的 **Zhiling API** 作为 P0 Current Provider；不回退到已废弃的旧 Provider。业务层仅消费统一 `ResolveResult`，Provider 的请求与原始响应仅保留在 Adapter 内。

本轮按顺序完成 DEV-03、DEV-05、DEV-06、DEV-07、DEV-08、DEV-09，交付可长期维护的多租户 SaaS 闭环。P0 不新增支付、订阅、分销、团队、多 Provider 智能路由或本地 AI 处理能力。

## 管理端架构

### 一个入口、两套后台

- `apps/admin-portal`：唯一登录入口 `/admin`。登录后依据服务端签发 JWT 中的 `role` 自动跳转。
- `apps/tenant-admin`：租户运营后台。只会请求自身 tenant 范围的接口。
- `apps/super-admin`：平台总端。管理租户、Provider 与全局统计。
- `packages/admin-ui`：布局、表格状态、空状态、鉴权请求等可复用组件与样式。
- `packages/contracts`：前后端共享 DTO、枚举与 API 类型。

三个 Web 应用采用 Vue 3、Vite、TypeScript、Vue Router、Pinia、Element Plus。看板仅使用 API 返回的真实数据；图表使用 ECharts，空数据展示明确空状态而非伪造指标。

### 访问控制

- JWT 由服务端的管理员登录接口签发，包含 `sub`、`role` 和（租户管理员必须有的）`tenantId`。
- Tenant API 在每个查询和 mutation 中由 session 推导 tenant scope，永不接收前端传来的 tenantId 作为授权条件。
- Super API 只允许 `SUPER_ADMIN`。Tenant API 只允许 `TENANT_ADMIN`。
- 每次敏感 mutation 写入 `audit_log`，记录 actor、tenant、动作、目标、脱敏前后值和时间。

## API 与数据模块

### DEV-03：账本一致性

`ResolveService` 继续在同一数据库事务内执行：写入成功 Job / Media、原子扣用户 points、原子扣 tenant quota、分别写入 `points_ledger` 与 `quota_ledger`。Provider 失败、点数不足、quota 不足、能力禁用或租户不可用均不会扣减。

提交前用 user + URL hash 短窗口复用与 idempotency key 防重复；余额与 quota 使用条件更新保证并发下不超扣。补齐覆盖成功、失败、余额不足、quota 不足、重复、并发、跨租户的自动化测试。

### DEV-05：媒体代理

媒体代理仅可读取数据库中已成功解析的 `ResolveMedia`，使用短时 HMAC URL。签名绑定 media、owner tenant / user 和 expiry；不接受任意外部 URL。后端保留 SSRF、内容类型、大小和超时校验。小程序使用代理地址预览、下载并保存；真机保存单独标记为手工验收项。

### DEV-06：Tenant Admin API 与界面

菜单固定为：概览、用户、点数流水、兑换码、解析记录、额度、平台能力、设置。

- 概览：今日解析、成功率、用户数、新增用户、剩余额度、points 总量、当日兑换、按已授权 capability 的平台分布。
- 用户：分页、搜索、状态筛选、详情。增减 points 必填数量与原因，事务更新并写 ledger 与 audit。
- 兑换码：单个/批量创建、停用、状态与兑换信息；明文 code 仅在创建响应中返回一次，数据库仅存 hash/hint。
- 解析记录：显示 job、匿名用户、platform、provider、URL hash、media type、状态、耗时、成本与时间，不返回原分享 URL。
- 额度与能力：额度只读；可查看权限。租户只可关闭自己已授权 capability，不能自行开启未授权能力。
- 设置：小程序名称、公告、初始 points、单次 cost、客服联系方式、意向付费开关；Secret 只显示末四位，不回传明文。

### DEV-07：Super Admin API 与界面

菜单固定为：总览、租户、Provider、Provider 调用、审计日志。

- 总览：租户状态、用户/新增用户、今日解析/成功率、调用次数、成本、平均耗时，以及按租户和平台的真实分布。
- 租户：创建、编辑、暂停/启用、设置到期时间、调整 quota（必填原因，写 quota ledger）、配置 capabilities、创建管理员、重置管理员密码。
- Provider：显示 Current Provider 的名称、Base URL、状态、优先级、超时、能力、成本配置与 Secret 掩码；只能重新设置 Secret，不能读取完整值。连接测试使用管理员提供的最小测试链接并明确可能计入上游调用。
- 调用与成本：使用 `ProviderCall`、`ResolveJob` 汇总成功、失败、成功率、平均 latency、成本、最近错误与最近成功。

## 安全、观测与测试

### DEV-08

- 为登录、解析、兑换和媒体下载添加按 IP / session 的合理限流。
- 管理员关键操作全部写审计记录，Secret 与分享链接仅以掩码、hash 或末四位出现。
- 自动测试覆盖水平越权、垂直越权、JWT 无效、过期媒体签名、SSRF、兑换码重放、重复请求与并发扣减。
- 事件使用真实执行路径写入，覆盖 resolve、save、redeem、paywall 等核心漏斗。

### DEV-09

执行 API、单元/集成、构建、Docker 启动和浏览器验收。生成 DEV-00-09、测试、AC、变更、安全、Provider、手工步骤、Backlog 与最终报告。只将实际验证的项标记 PASS；真机保存、生产域名/HTTPS 与 Provider 未验证平台明确标记 BLOCKED 或 PARTIAL。

## 验收与错误处理

- 前端统一展示用户可理解的业务错误，不展示上游原始响应或 Secret。
- 管理端 mutation 成功后刷新真实数据，失败后保留用户输入并展示可追踪的错误提示。
- 删除/停用类动作使用确认提示；不会实现不可恢复的数据清除。
- 所有后台页面提供加载、空数据、无权限和接口失败状态。

## 部署形态

本地由 Docker Compose 保持 PostgreSQL 与 API；管理端分别以 Vite 构建为静态站点。生产必须将 API / Media Proxy 置于 HTTPS 域名并配置微信合法域名。管理员初始 Seed 账号只用于本地，生产部署时必须改密钥与密码。
