# DEV-00｜CanxiangProvider 技术验证

执行命令：`pnpm smoke:canxiang`。

## 当前结果（2026-08-27）

| 平台 | 真实验证 | 状态 | 原因 |
| --- | --- | --- | --- |
| 豆包 | 未执行 | BLOCKED | 当前环境未配置 `CANXIANG_TOKEN` 与已授权真实样本 |
| 抖音 | 未执行 | BLOCKED | 当前环境未配置 `CANXIANG_TOKEN` 与已授权真实样本 |
| 小红书 | 未执行 | BLOCKED | 当前环境未配置 `CANXIANG_TOKEN` 与已授权真实样本 |
| 千问 | 未执行 | BLOCKED | 当前环境未配置 `CANXIANG_TOKEN` 与已授权真实样本 |

## 已完成

- `.env.example` 已定义仅服务端使用的残像环境变量。
- 真实烟测脚本会调用四个正式端点，输出脱敏 URL 哈希、HTTP 状态、耗时和响应字段形状；不会输出 Token、完整分享链接或媒体地址。
- `CanxiangProvider` 使用同一环境变量和四个能力端点；`MockProvider` 仅由显式 `RESOLVER_MODE=mock` 启用。

## 人工补充步骤

1. 在本机或 Staging 的服务端 `.env` 设置 `CANXIANG_TOKEN` 和四个平台的合法测试样本。
2. 运行 `pnpm smoke:canxiang`，将脱敏输出补充到本报告。
3. 根据真实 response shape 调整 `CanxiangProvider` 的字段映射，并重新执行集成测试。

