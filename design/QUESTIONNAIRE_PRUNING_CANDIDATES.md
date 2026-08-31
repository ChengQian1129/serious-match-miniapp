# Questionnaire pruning candidates

本轮不删题、不改顺序、不改计分。下面只是等真人 completion time、abandonment、item hesitation 和回答质量数据后再研究的候选，当前状态全部为 `CANDIDATE`。

| ID | 候选范围 | 观察假设 | 需要的证据 | 状态 |
| --- | --- | --- | --- | --- |
| PRUNE-001 | 同一主题下语义接近的自评题 | 可能造成用户感到重复 | task-level duration、跳出率、回答分布、访谈反馈 | `CANDIDATE` |
| PRUNE-002 | 多选题后紧邻的解释性追问 | 可能增加切换成本 | 完成率、回退次数、失焦/重选次数 | `CANDIDATE` |
| PRUNE-003 | 基本情况与生活安排中信息边界接近的题 | 可能让用户不确定区别 | 认知访谈、误答反馈、重复回答模式 | `CANDIDATE` |
| PRUNE-004 | 冲突与修复部分的相邻情境题 | 可能增加后半程负担 | Section 6 用时、暂停率、开放反馈 | `CANDIDATE` |

## Measurement contract

- 仅记录隐私安全的 `taskId`、`taskIndex`、`sectionId`、时间桶和 section enter/complete 时间。
- 不记录 raw answer、free text、手机号、微信号或姓名。
- 在有足够真人数据前，候选不得变成 `REMOVE`，也不得从 canonical questionnaire source 或生成 bundle 删除。
