# Product v0 UX maturity acceptance

版本：`3.0.0-product-v0`
更新：2026-08-31

这份文档是发布门槛，不是“看起来差不多”的设计说明。状态只使用 `PASS`、`FAIL`、`NOT VERIFIED`、`BLOCKED`；只有自动化、开发者工具人工巡检、真实设备与线上配置四类证据都满足时，才能把版本标记为正式 release。

## 范围与不可变约束

- 保留 Product v0 现有的 266 个 parent tasks、307 个 response fields、14 个维度、6 个核心章节、计分规则、报告推断规则和研究状态。
- 新增的是旅程编排、渐进披露、恢复与编辑闭环、反馈和错误态；不新增匹配、社交、付费或游戏化能力。
- `friendComparison`、`matchingProfile`、`matchingPool` 继续关闭。
- 用户回答事件保持不可变；改答通过新事件重算，并递增 `reportVersion`。
- 题库、计分包、公开文案、报告 renderer 与云函数生成文件只能通过同步脚本生成，禁止手改生成副本。

## 自动化门槛

在仓库根目录运行：

```text
npm run sync:release
npm test
```

每条命令必须以退出码 `0` 结束。同步完成后，`npm run check:release` 还必须确认 canonical source 与四套云服务生成物一致。

npm 依赖构建不是仓库脚本：需要在微信开发者工具中执行“工具 → 构建 npm”，然后检查模拟器和上传预览包体积。不要把本地 `npm test` 误写成已经完成了微信工具构建。

本轮 Product v0 专项回归状态：PASS：

- 静态题库/计分检查：266 parent tasks、307 response fields、14 dimensions、8 strategy families。
- 运行时：原始回答、缺失性、策略向量、能力边界、不可变事件。
- 页面：10 段动态旅程、部分结果、checkpoint、答案复核、精确题目编辑、重算和 report revision。
- 云端：草稿 stale protection、完成报告、反馈幂等、恢复、历史版本和删除。

最终 release 前应把三条命令的实际日期、耗时和结果补记到 `design/RELEASE_CHECKLIST.md`，不要用“之前通过”代替当前工作树的结果。

## 可复现人工场景

| 场景 | 通过条件 | 当前证据 |
| --- | --- | --- |
| 首次开始 | Welcome 的一次点击进入 Home 恢复门禁，随后进入答题；不重复欢迎流程 | PASS（DevTools 模拟） |
| 本地继续 | 有本地答案时显示已完成/进行中状态；不会静默清零或覆盖 | PASS（自动化）；DevTools 再走查 NOT VERIFIED |
| 恢复门禁 | `INITIALIZING`/`RESTORING` 时不能创建新答题；恢复失败有重试、本地继续、离线入口 | PASS（自动化）；真机弱网 NOT VERIFIED |
| 云端冲突 | 本地未同步答案和云端较新答案同时存在时，用户明确选择本地或云端 | PASS（自动化）；双设备 NOT VERIFIED |
| 320px 问卷 | 长题干正常换行；未回答点击继续显示内联错误并可定位；选中后错误清除并继续 | PASS（DevTools 模拟） |
| 复杂题型 | 多选、数字、文本、失焦保存、返回上一题、退出后继续均可完成 | PASS（自动化）；完整点击路径 NOT VERIFIED |
| 动态进度 | 页面显示第 `n / 10` 部分和全局进度；C6 完成后明确剩余 4 个部分，不出现虚假的 100% | PASS（自动化）；完整点击路径 NOT VERIFIED |
| checkpoint | 每段完成后显示本段洞察/完成确认；未完成时只显示已完成部分，不冒充完整报告 | PASS（自动化） |
| 部分结果 | 中途可查看已完成部分；继续按钮回到当前任务；未开放部分有解释 | PASS（自动化） |
| 完整结果 | 完成 10 段后才显示完整结果、决策地图、未知项和访谈优先级 | PASS（自动化）；真实全量点击 NOT VERIFIED |
| 答案复核 | 结果 → 答案复核 → 精确题目 → 修改 → 重算 → 返回原结果位置 | PASS（自动化）；真机 NOT VERIFIED |
| 依据链路 | 结果维度 → evidence → 对应题目 → 修改回答；没有无目标的“从第一题重来” | PASS（自动化）；真机 NOT VERIFIED |
| 目标级反馈 | pattern/chapter/dimension/result 都能选择 fits/does-not-fit；可选原因；云端重复提交幂等 | PASS（自动化）；真实云环境 NOT VERIFIED |
| 离线/失败 | 本地保存状态清晰；同步失败不丢答；重新联网可重试；删除有确认并清理本人数据 | PASS（自动化）；真机弱网 NOT VERIFIED |
| 响应式与可访问性 | 320/375/390/430px 不横向溢出；主要按钮触控高度至少 44px；错误/状态有语义文本 | 320px PASS（DevTools 模拟）；其余 NOT VERIFIED |

## 设备、网络和后台门槛

以下项目不能由本地单元测试替代，当前均应在发布前重新打勾：

- [ ] iPhone 小屏真机：首次、恢复、复杂题型、完整结果、编辑闭环。
- [ ] 普通 Android 真机：同上，并检查字体回退、底部安全区和滚动行为。
- [ ] 320/375/390/430px 实际窗口：无横向溢出、无文字挤在中央、底部 CTA 不遮挡内容。
- [ ] 弱网/断网：完成一部分、退出、恢复网络、继续同步；云端失败可恢复。
- [ ] 双设备：本地 pending 与云端较新版本产生冲突时能明确选择，不静默覆盖。
- [ ] 云开发权限：客户端不能直接读写 `assessment_sessions`、`assessment_reports`、`assessment_feedback_events` 等集合。
- [ ] 云函数部署：`assessmentService`、`participantService`、`interviewOps`、`datingProfile` 均部署当前同步生成物。
- [ ] 微信隐私、运营主体、保存期限、用户权利和客服入口已在后台核对。

## 发布判定

代码层 hardening 目标已覆盖，当前可作为 code-level Release Candidate 审查；它还不能被描述为“正式发布完成”。在上述全量门禁、真机、弱网、双设备、云权限、部署和微信后台项目完成前，发布状态保持 `NOT VERIFIED`。
