# Product v0 release checklist

版本：`3.0.0-product-v0`

当前状态：`RC / NOT VERIFIED`
说明：本轮 RC hardening 已推送提交 `80d1d90`；尚未重新上传体验版或重新部署云函数。

## 已由仓库自动验证

- `npm run sync:release`：2026-08-31 通过；`check-release` 确认文案、题库、计分包、兼容包和云函数生成文件一致。
- `npm test`：2026-08-31 通过；全量旧版/V3/Pilot/P0/Product v0 回归、公共边界和云端契约均以退出码 0 完成。
- GitHub Actions `release checks`：`NOT VERIFIED`；基线失败根因是 `check-public-language.js` 默认 locale 排序，已改为确定性 comparator，修复已推送，待新运行验证。
- 微信开发者工具“工具 → 构建 npm”：2026-08-30 已在当前工作树完成，提示耗时 `4116 ms`；仓库没有用脚本冒充该工具动作。
- Product v0 主包估算：约 `1.41 MB / 1.84 MB`（`1441 KB / 1844 KB`），低于门禁。
- 此前 DevTools 体验版上传实测：`1,214,992 bytes`（约 `1.2 MB / 2 MB`），已成功上传版本 `3.0.0`；当前工作树的结果页、恢复、反馈、编辑边界和生成链修订尚未重新上传新的体验版。
- `FEATURES.v3ProductV0 = true`，`v3ProductPreview = false`，`v3CalibratedProduction = false`。

## 上轮人工回归（2026-08-30）

- 微信开发者工具当前小屏模拟器（约 320px）已检查 Welcome、一次开始、问卷头部、长题干换行、必答题内联错误、选择恢复和本机保存状态。
- 已确认动态头部显示 `第 10 / 10 部分`、当前任务数和全局进度；长题干未被挤在中央，未回答点击“继续”会定位到错误而不是进入死路。
- 已确认新页面重新编译后没有新增业务 WXML/WXSS/runtime 错误。控制台剩余的是开发者工具/基础库版本、`wx.getSystemInfoSync` 弃用、SharedArrayBuffer 和 worker 能力提示。
- Product v0 的完整 10 段结果、目标级反馈、答案复核和云端恢复由自动化覆盖；尚未用真实 266 题逐题走完结果页，也尚未替代真机 Android/iOS、弱网、双设备和云权限验收。

## 本轮 RC hardening 专项回归（2026-08-31）

- `canFinishEditing(session, taskId)` 已将 task 编辑完成与整份 assessment completion 分开；C1 部分结果编辑后仍保持 incomplete。
- Answer Review 行现在明确带有 `answered`/`editable`，未来 task 在页面行为和 questionnaire URL 入口均被拦截。
- Evidence/Review 使用结构化 `returnContext`，覆盖返回原结果、原依据和原复核部分。
- Restore A–G、RESTORING 快速点击、较新本机同步、网络失败本机保存状态均补了测试。
- Partial report 不再先生成完整 report 再用视图隐藏 final-only 内容。
- 完整手工走查清单见 `design/FULL_JOURNEY_MANUAL_TEST.md`；本轮真实设备状态仍为 `NOT VERIFIED`。

## 发布前必须在微信工具/真机完成

1. 登录微信开发者工具，打开当前 AppID 项目，执行“工具 → 构建 npm”。
2. 本轮修改了云端反馈和生成链，必须重新执行 `npm run deploy:cloud`，并确认 `assessmentService`、`participantService`、`interviewOps`、`datingProfile` 四项均为成功。
3. 在 iPhone 小屏、普通 Android 和窄屏设备各走一次：首次进入、选择题、多选题、数字/文本题、失焦保存、返回继续、章节切换、完成报告、依据页、修改回答、重新回答和删除结果。
4. 断网完成一部分回答，退出后恢复网络并重新进入，确认本机答案仍在且能同步；再从另一台设备确认云端恢复。
5. 在云开发控制台确认十个集合均为客户端不可读、不可写；测试删除后确认本人的 session、report 和反馈记录已清理。
6. 在微信后台核对隐私政策、运营主体、保存期限、用户权利和客服入口，再提交体验版或审核版。

## 当前外部阻塞

已有版本 `3.0.0` 体验版上传记录，但本轮最新布局、恢复、反馈、编辑边界和云函数生成物尚未重新上传/部署。剩余是 GitHub Actions 新运行、微信工具/真机与后台人工验收：真实设备回归、弱网和双设备、云开发权限核对、隐私资料核对，以及提交体验版/审核版。

正式发布仍需要微信后台的人工审核/提交动作，这不由仓库脚本代替。
