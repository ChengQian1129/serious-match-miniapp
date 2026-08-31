# Product v0 RC hardening status

版本：`3.0.0-product-v0`

更新：2026-08-31

基线：`fb805125b16372d265de3a7051aa7b2ed3a25668`（`feat: complete UX maturity refactor`）

这是一份事实状态表。`PASS` 只表示对应证据已经完成；`NOT VERIFIED` 表示需要微信工具、真机、真实云环境或下一次 CI 运行，不能用本地单元测试代替。

## Build

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| `npm run sync:release` | PASS | 2026-08-31，本地生成链和 `check-release` 通过 |
| `npm test` | PASS | 2026-08-31，本地全量回归退出码 0；包含本轮 Product v0 RC 测试 |
| GitHub Actions `release checks` | NOT VERIFIED | 基线运行曾因跨平台 locale 排序失败；已修复并补回归，待推送后的新运行 |
| 生成文件无 drift | PASS | `sync:release` 后 `check-release` 通过 |
| 项目 Node runtime | PASS | workflow 固定 Node 20；Actions runtime warning 与项目 runtime 分开处理 |

## UX P0

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 部分结果编辑已回答 task | PASS | `assessment-v3-product-v0-pages.test.js`：C1 部分结果 → Review → Edit → Partial Result |
| 未回答未来 task 锁定 | PASS | Review 行 `editable` 与 questionnaire `mode=edit` 二次校验 |
| Evidence 精确来源编辑 | PASS | exact `taskId`/`itemId`、结构化返回上下文、immutable event 和 revision 回归 |
| 完整评估编辑重算 | PASS | 本地 `reportRevision` 递增；云端历史契约已有版本保留测试 |
| Restore CTA race | PASS | `assessment-v3-product-v0-home.test.js` 覆盖 `RESTORING` 快速点击 |
| Full journey | PASS | 10 个部分、section transition、C6 后未完成、最后 task 后 final report |
| 页面栈边界 | NOT VERIFIED | 已使用 `redirectTo`/`navigateBack` 设计，仍需微信工具长链人工走查 |

## Device

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| iPhone 真机 | NOT VERIFIED | 需要真实微信 iOS 环境 |
| Android 真机 | NOT VERIFIED | 需要真实微信 Android 环境 |
| 320/375/390/430 窗口 | NOT VERIFIED | 320px 曾在 DevTools 检查过；本轮其他尺寸未重新完成 |

## Network

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 本地先保存、云端失败提示 | PASS | 页面专项测试验证 `已保存在本机` 与 `CLOUD_FAILED` |
| 离线恢复/重试 | PASS | 自动化状态机和页面测试通过 |
| 弱网真实体验 | NOT VERIFIED | 需要真机网络切换 |
| 后台/前台/kill/reopen | NOT VERIFIED | 需要微信工具或真机执行 |

## Cloud

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| restore A–G 决策矩阵 | PASS | `assessment-v3-product-v0-restore.test.js` 与 Home 测试 |
| stale write / conflict / history | PASS | `cloud-assessment-v3-product-v0.test.js` |
| 真实云函数部署 | NOT VERIFIED | 本轮未代替运营者执行部署 |
| 集合客户端权限 | NOT VERIFIED | 需要云开发控制台核对 |
| 删除 session/report/feedback | PASS | 本地云函数契约测试；真实环境仍需人工确认 |

## Privacy

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 公共文案边界与 raw error 扫描 | PASS | `check-public-language` 与 `check-public-boundary` |
| telemetry 不记录回答内容 | PASS | Product 关键事件只携带 task/section/类别/版本等安全字段 |
| 微信隐私后台与保存期限 | NOT VERIFIED | 需要运营主体在微信后台确认 |
| 真实云环境数据库规则 | NOT VERIFIED | 需要云开发控制台确认 |

## CI root cause record

| 字段 | 记录 |
| --- | --- |
| command | GitHub Actions `npm test` |
| first assertion | `scripts/check-public-language.js:247`：Public language snapshot changed |
| expected/actual | Ubuntu/Node 20 的 `localeCompare()` 顺序与 Windows/Node 20 快照不同；例如 `profile.availability` 与 `profile.availabilityPlaceholder`、中文键和数字键顺序不同 |
| root cause | 默认 locale collation 依赖运行主机，生成快照不是确定性的 |
| fix | 改为显式 code-unit comparator，重生成快照，并新增 `tests/public-language-determinism.test.js` |

## Product model changes

scoring changed: NO

dimensions changed: NO

questionnaire items removed: NO

report inference changed: NO

当前可称为：代码层面的 Release Candidate（本地全量测试已通过，待 GitHub Actions、微信工具/真机、真实云环境和后台外部验收）。不能称为正式发布完成。
