# AI 素材助手 SaaS｜DEV-09 验收报告

验收时间：2026-08-28（本地）  
验收范围：已确认的 DEV-03、DEV-05～DEV-09 收口工作，以及此前已完成的小程序解析链路。

## 交付状态

| 模块 | 状态 | 已验证内容 |
| --- | --- | --- |
| DEV-03 账本与幂等 | PASS（代码与单元测试） | 解析成功在事务中扣点、扣租户额度并写入 points/quota 流水；失败不扣减；URL hash、幂等键与条件更新用于避免重复/超扣。自动化覆盖成功、上游失败、点数不足与短窗口重复。 |
| DEV-05 媒体代理 | PASS（自动化）/ PARTIAL（真机） | 已成功 Job + 短时 HMAC 才可访问媒体；签名、SSRF 和本地地址拦截测试通过。真机保存素材仍需上线域名后人工验收。 |
| DEV-06 租户后台 | PASS | Vue 3 租户后台与 `/api/tenant-admin/*` 已完成：概览、用户/点数、兑换码、记录、额度、能力、设置，均取真实 API 数据。 |
| DEV-07 平台总后台 | PASS | Vue 3 平台后台与 `/api/super-admin/*` 已完成：总览、租户、Provider、调用记录、审计日志；Secret 仅掩码展示。 |
| DEV-08 安全与观测 | PASS（当前覆盖） | 管理登录、解析、兑换、媒体下载限流；角色隔离、HMAC、SSRF、Provider 调用记录、管理员审计记录均已实现。 |
| DEV-09 构建与容器 | PASS | 所有工作区生产构建、API 测试、Docker Compose 启动、管理员登录及跨后台权限隔离均已实际验证。 |

## 实际执行结果

- `pnpm --filter @ai-material/api test`：4 个测试套件、16 项测试全部通过。
- `pnpm --filter @ai-material/api typecheck` 与 API 生产构建：通过。
- `pnpm -r build`：小程序、API、共享契约、共享后台样式、登录入口、租户后台、平台总后台全部通过。
- Docker Compose：PostgreSQL 健康、API 正常启动，`/health` 返回 `{"status":"ok"}`。
- 容器内种子管理员验证：平台总后台访问总端接口为 200；其访问租户接口为 401。租户管理员访问租户接口为 200；其访问总端接口为 401。

## 本轮修正

- 修复容器运行时 `argon2` 默认导入兼容性，避免管理员登录出现 500。
- Compose 支持 `API_HOST_PORT` 与 `POSTGRES_HOST_PORT` 覆盖，开发机端口冲突时无需改文件。
- 为共享后台 UI 包补上 TypeScript 入口，纳入全工作区构建。

## 尚需人工/生产验收

| 项目 | 状态 | 原因与下一步 |
| --- | --- | --- |
| 微信真机预览、保存图片/视频 | PARTIAL | 需使用生产 HTTPS 域名、配置微信合法域名后在 iOS/Android 真机分别验证。 |
| 智凌 API 的全部 30+ 平台 | PARTIAL | 已完成真实接口接入与模拟响应映射；逐平台外部调用会产生上游费用，应使用用户提供的测试链接逐项验收。 |
| 管理端浏览器交互走查 | PARTIAL | 已通过 TypeScript/Vite 生产构建和 API 容器联调；需部署静态站点后按真实角色完成最终 UI 走查。 |
| 生产安全配置 | BLOCKED（待部署信息） | 部署前必须更换种子账号密码、JWT 密钥、数据库密码和 Provider Key；配置 HTTPS、备份与日志保留策略。 |

## 维护提示

- 本地容器如遇端口占用：`API_HOST_PORT=3100 POSTGRES_HOST_PORT=5433 docker compose up -d --build`。
- Provider Key 仅保留在 `.env`，不得提交；后台只允许覆盖 Secret，永不返回明文。
- 当前管理端构建产物的单文件体积约 1 MB，功能不受影响；生产优化可加入按路由拆包，列入后续性能 Backlog。
