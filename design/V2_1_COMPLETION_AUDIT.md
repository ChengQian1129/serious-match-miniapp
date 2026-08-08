# v2.1 完成度审计

版本：`2.1.0-pilot-interview`  
审计依据：`关系说明书 v2.1 完整实施方案`  
原则：只有代码、测试、部署状态或人工回归能够直接证明的项目才标记完成。

## Definition of Done

| # | 要求 | 状态 | 当前证据 |
| --- | --- | --- | --- |
| 1 | 公开端没有双人比较、对象推荐或匹配池 | 已完成 | `app.json` 路由、`check-public-boundary.js`、`public-boundary.test.js` |
| 2 | 不提供联系方式也可获得完整报告 | 已完成 | 报告生成先于且独立于 `followup-*` 页面；页面和云函数测试覆盖 |
| 3 | 后续联系独立、自愿、可撤回 | 已完成 | 三个独立授权事件、默认关闭、失败重试、撤回与删除测试 |
| 4 | 48 题、规格、客户端和云端一致 | 已完成 | 单一来源、生成哈希及 `assessment-schema-sync.test.js` |
| 5 | 旧数据不会静默丢失 | 已豁免 | 试点前无正式数据，产品方明确允许删除旧题目和旧数据；不执行迁移 |
| 6 | 每条报告结论有精确支持证据 | 已完成 | 证据选择器与 `report-evidence.test.js` |
| 7 | 组合结论检查反向和限定证据 | 已完成 | 显式 contradiction/qualification selectors 与测试 |
| 8 | 作答质量影响置信度但不判用户无效 | 已完成 | 质量引擎及 `report-confidence.test.js` |
| 9 | 用户反馈为不可变事件 | 已完成 | `assessment_feedback_events`、冲突保护和历史投影测试 |
| 10 | 内部可生成访谈准备卡 | 已完成 | 确定性假设、服务端盲法门禁、独立观察和模型核对两阶段准备卡测试 |
| 11 | 访谈结果可逐条验证 | 已完成 | 揭盲前独立判断、揭盲后 claim/hypothesis 验证和题目理解事件，含版本与不可变冲突保护 |
| 12 | 访谈与评估保存版本快照 | 已完成 | case/report/preparation/validation 快照字段与云函数测试 |
| 13 | 参与者、报告、联系方式分层存储 | 已完成 | 真实试点环境已创建七个剩余集合；十个 v2.1 集合均为客户端不可读写，联系方式独立进入 `participant_contacts` |
| 14 | 运营接口有角色权限和审计 | 已完成 | 三服务边界、角色矩阵、掩码/单独联系方式授权、成功与失败审计测试 |
| 15 | 自动化测试和微信人工回归通过 | 部分完成 | 本地测试、干净检出、GitHub CI、微信预览编译已通过；四个云函数实时状态均为 `Active`，真实云端已验证草稿、完整报告、研究授权、联系授权、参与资料写入与删除；真机布局、输入法、弱网失败重试和完整访谈链路仍待完成 |
| 16 | README、隐私说明、产品文案与功能一致 | 已完成 | README、隐私页、云集合说明和静态 DoD 检查 |

## 云端上线门槛

完成以下事项后才能把 v2.1 标记为完成：

1. 创建 `consent_events`、`participant_registry`、`participant_contacts`、`interview_cases`、`interview_validation_events`、`operator_accounts`、`audit_events`。
2. 十个 v2.1 集合全部设置为客户端不可读写，只允许云函数访问。
3. 在真实云环境完成问卷草稿、报告、反馈、三个授权、参与资料、撤回和删除回归。
4. 确认联系方式只进入 `participant_contacts`。
5. 确认未授权研究的数据不会进入去标识化导出和试点指标。
6. 使用真机完成页面布局、返回、下一步、输入法和弱网失败重试检查。

## 已部署服务

- `assessmentService`：用户评估、报告、反馈和删除。
- `participantService`：分用途授权、参与资料、撤回和删除。
- `interviewOps`：角色受限的案例、准备卡、验证、审计和研究导出。
- `datingProfile`：试点阶段兼容入口，新客户端不再以它作为主调用路径。

## 云端集合落地证据（2026-08-07）

环境：真实试点云环境（公开文档不记录环境标识）。

已核验集合：`assessment_feedback_events`、`assessment_reports`、`assessment_sessions`、`consent_events`、`participant_registry`、`participant_contacts`、`interview_cases`、`interview_validation_events`、`operator_accounts`、`audit_events`，以及历史兼容集合 `dating_profiles`。

新建七个集合时逐项选择并提交了“所有用户不可读写”；控制台权限页抽查显示该权限已生效。云函数仍通过服务端访问这些集合。

同日重新执行 `npm test`，全套静态检查和行为测试通过；微信 CLI 预览编译成功，包体 555473 字节（约 542.5 KB）。通过微信 CLI 实时查询，`assessmentService`、`participantService`、`interviewOps` 和兼容入口 `datingProfile` 状态均为 `Active`。

## 真实云草稿回归（2026-08-08）

四个云函数重新部署后，在微信开发者工具中使用真实云环境完成 C1 连续作答、自动草稿保存、章节完成和阶段发现展示。首次回归发现 CloudBase 不允许 `set` 数据携带顶层 `_id`；现已统一在服务端写入前剥离 `_id`，并让云端测试桩复现该限制。修复重新部署后，清空控制台再次连续作答，草稿保存不再报错。

同一环境还验证了仅授予 `research_use`：授权成功后 `participant` 与 `contact` 均为 `null`，没有强迫创建参与资料或联系方式；随后执行 `participantDelete`，再次读取确认授权投影为空，测试数据已清理。

同一轮继续完成 C1-C6 共 48 题、完整关系报告生成与展示；仅授予 `research_use` 时 `participant` 和 `contact` 均保持为空。开启联系类授权后，页面会先引导填写称呼、区域、方便参与时间和联系方式；真实云端写入成功，`availability` 保存于 `participant_registry`，联系方式的 `value/channel` 仅写入 `participant_contacts`，不会进入参与者公开登记文档。随后执行 `participantDelete`，复查参与者、联系方式和授权投影均为空，测试数据已清理。

本轮已证明真实云草稿、完整报告、研究单独授权、联系授权、参与资料写入和删除链路可用；撤回、盲法访谈、独立访谈判断和真机布局仍按上线门槛继续回归。

## Content Experience v1.0 Sprint 1（2026-08-08）

本轮按《关系说明书 Content Experience v1.0》先完成不改测量结构的内容层改造：

- 48 题、计分逻辑、证据选择器和 `instrumentVersion=2.1.1-pilot` 保持不变。
- 首页改为具体关系场景入口，移除“六章/阶段发现/完整说明书”的流程解释。
- 每章第一题前增加独立章节开场，后续题目不再重复章节说明。
- 阶段页改为一条核心洞察、一个细节、一个反思问题；证据和边界默认收起。
- 报告主视图隐藏证据数量、置信度和规则版本；结论详情保留完整证据，并改用用户侧语言。
- 关系地图改名为“我目前比较确定的”，移除“关系资源/内部拉扯”等内部标签；第一版暂不公开“相处名片”入口。
- 新增 `CONTENT_VERSION` / `REPORT_COPY_VERSION`；规则文件只保留逻辑，用户文案进入独立 `shared/content/claim-copy.js`，客户端和云函数生成副本均受同步检查保护。

这部分的代码、静态页面约束和内容版本测试已通过 `npm test`。尚未由代码证明的体验指标包括：用户是否想到具体经历、哪句话最有共鸣、哪句话仍显得空泛或像 AI；这些必须在冻结题库后用 8–12 人认知访谈验证。

## Content Experience v1.1 Sprint 2（2026-08-08）

本轮继续只改内容与呈现层：Welcome 改为单页，报告改为 narrative-first，Follow-up 三页接入 `followup-copy.js`，证据与术语统一进入内容系统；未修改题库、计分、规则、授权语义或后端 schema。具体变更和回归边界见 `design/CONTENT_EXPERIENCE_SPRINT_2_AUDIT.md`。

本地完整测试和内容边界测试已通过。2026-08-08 重新执行 `npm run deploy:cloud`，`assessmentService`、`participantService`、`interviewOps` 和兼容入口 `datingProfile` 均部署成功；真实用户、真机布局、输入法、弱网失败重试和完整访谈链路仍按云端上线门槛继续回归。
