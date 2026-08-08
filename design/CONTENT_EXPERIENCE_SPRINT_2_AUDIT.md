# Content Experience Sprint 2 审计

## Baseline

基线为 `69d7f7a` 的 Content Experience Sprint 1。Sprint 2 只改公开内容、呈现层和保护这些边界的测试。

## Changed

- Welcome 从三页轮播改为单页：真实关系问题、时长、单一开始入口和方法说明弹层；移除 slide state、dots、页码和 `welcome_slide`。
- 首页继续使用具体关系情境入口，进行中、已完成和方法说明文案集中到内容系统。
- 问卷只显示“第 X 组 / 6”和当前题进度，不再向用户展示 construct / dimension 名称。
- 阶段页统一“像你吗？”选项，依据默认折叠并使用统一 evidence copy。
- 报告改为 narrative-first：先展示最重要的 hero claim，再按关系情境分组；观察动作只在没有被组合结论覆盖时放到末尾。
- 报告主页面隐藏技术证据、置信度、规则版本和内部 section key；删除、修改、关系地图和后续参与入口重新排到数据管理和正文之后。
- 结论详情保留完整支持、矛盾、限定、替代解释和验证问题；方法信息折叠后才显示技术版本与证据数量；反馈统一为一个文本框。
- Follow-up intro、settings、profile 全部改用 `followup-copy.js`，先解释为什么值得继续聊，再做三个独立用途选择；研究用途不要求联系方式。
- 新增 `evidence-copy.js`、`glossary.js`、`VOICE_AND_TONE.md`、`CONTENT_SPRINT_2_FOLLOWUPS.md` 和版本化副本同步。

## Not Changed

- 48 题、题目文字、题目 ID、顺序、量尺、反向计分和 `instrumentVersion=2.1.1-pilot` 未改变。
- 计分阈值、report rule 条件、support / contradiction / qualification selector 未改变。
- `consent` scope 语义、参与者和访谈后端 schema、盲法流程未改变。
- 未增加推荐、匹配、聊天、社交、LLM 动态报告或新的心理类型。

## Tests

- `npm.cmd test` 全部通过。
- `tests/content-sprint-2-regression.test.js` 固定了 48 题测量字段 hash、19 条报告规则及 selector hash。
- 内容版本为 `relationship-manual-copy-1.1.0` / `relationship-manual-report-copy-1.1.0`。
- `npm run sync:assessment` 后客户端与四份云函数报告/文案副本一致。

## Manual QA

代码和微信开发者工具静态预览编译检查已完成；以下真机检查由产品方继续执行：

- Welcome 首次进入、方法说明、开始后不重复出现。
- 长标题、长正文、证据展开、方法信息展开和底部操作栏在 iPhone、Android、小屏设备不截断、不溢出。
- 六组问卷 intro、返回、继续、草稿恢复和报告修改。
- Follow-up 的 research-only、联系授权、资料保存、修改、撤回和删除。

## Known Gaps

- 文案是否真正让用户想到具体经历、是否仍有 AI 味，必须通过 8-12 人认知访谈判断，不能由自动化测试代替。
- 2026-08-08 已在真实试点云环境重新执行 `npm run deploy:cloud`，`assessmentService`、`participantService`、`interviewOps` 和 `datingProfile` 均部署成功；后续仍需真机回归验证客户端到云端的完整链路。
- 正式公开测试前仍需运营主体联系方式、保存期限和用户权利的正式隐私政策审核。
