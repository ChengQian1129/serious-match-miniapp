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
| 10 | 内部可生成访谈准备卡 | 已完成 | 确定性假设、相对盲法和模型核对两阶段准备卡测试 |
| 11 | 访谈结果可逐条验证 | 已完成 | claim、hypothesis 和题目理解事件，含版本与不可变冲突保护 |
| 12 | 访谈与评估保存版本快照 | 已完成 | case/report/preparation/validation 快照字段与云函数测试 |
| 13 | 参与者、报告、联系方式分层存储 | 待云端确认 | 代码使用独立集合；仍需确认真实环境七个剩余集合已创建 |
| 14 | 运营接口有角色权限和审计 | 已完成 | 三服务边界、角色矩阵、掩码/单独联系方式授权、成功与失败审计测试 |
| 15 | 自动化测试和微信人工回归通过 | 部分完成 | 本地、干净检出、GitHub CI、微信预览编译已通过；真实云链路和真机回归待完成 |
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
