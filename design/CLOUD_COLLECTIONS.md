# v2.1 云数据库集合清单

在微信开发者工具的云开发环境 `cloud1-d9gbaxvo2f79f0457` 中创建以下集合。所有集合权限统一设置为“仅管理端可读写 / 客户端无权限”，小程序只能通过 `datingProfile` 云函数访问。

## 评估与反馈

| 集合 | 用途 | 关键字段 |
| --- | --- | --- |
| `assessment_sessions` | 当前用户问卷草稿和完成状态 | `_openid`, `assessmentId`, `instrumentVersion`, `answers`, `answerEvents`, `updatedAt` |
| `assessment_reports` | 版本化关系说明书 | `_openid`, `assessmentId`, `reportVersion`, `claims`, `allClaimCandidates`, `visibleClaimIds`, `userConfirmations` |
| `assessment_feedback_events` | 不可变的结论核对事件 | `_openid`, `eventId`, `reportId`, `claimId`, `value`, `createdAt`, `supersedesFeedbackId` |

## 后续参与

| 集合 | 用途 | 关键字段 |
| --- | --- | --- |
| `consent_events` | 按用途记录授权和撤回，不用一个 consent 覆盖多个目的 | `_openid`, `eventId`, `scope`, `value`, `version`, `createdAt` |
| `participant_registry` | 参与者筛选所需的非联系方式资料 | `_openid`, `contactRef`, `participationTypes`, `cityArea`, `availability`, `status`, `updatedAt` |
| `participant_contacts` | 与评估数据隔离的联系方式 | `_openid`, `channel`, `value`, `preferredTime`, `updatedAt` |
| `interview_cases` | 私有访谈案例与报告快照 | `participantId`, `assignedOperatorOpenid`, `status`, `reportSnapshot`, `preparation` |
| `interview_validation_events` | 逐条访谈验证事件 | `caseId`, `participantId`, `claimId`, `verdict`, `observedAt`, `operatorOpenid` |
| `operator_accounts` | 运营、访谈和分析角色 | `_openid`, `role`, `status` |
| `audit_events` | 敏感运营操作审计 | `actorOpenid`, `action`, `targetId`, `result`, `createdAt` |

## 授权范围

当前支持三个互相独立的 scope：

- `interview_contact`: 允许运营人员按留下的渠道联系访谈
- `research_use`: 允许去标识化结果用于问卷与报告研究
- `offline_invitation`: 允许发送线下活动信息；具体活动仍需另行确认

撤回 `interview_contact` 会把参与者状态改为 `withdrawn`，但不会删除或改写已经生成的问卷和报告。用户选择“删除参与登记”时，云函数会删除以上三个参与集合中的本人记录；删除关系评估时，反馈事件也会一并删除。

## 创建后检查

1. 在云开发控制台确认十个集合均存在，权限不是“所有用户可读写”。
2. 使用开发者工具预览完成一次问卷，确认 `assessment_sessions` 和 `assessment_reports` 有记录。
3. 在报告页进入“后续参与”，分别打开和关闭三个授权，确认 `consent_events` 每次产生新事件。
4. 保存参与资料后确认联系方式只出现在 `participant_contacts`，不出现在报告文档。
