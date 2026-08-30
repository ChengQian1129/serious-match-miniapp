# Product v0 questionnaire burden plan

版本：`3.0.0-product-v0`
更新：2026-08-30

这份计划处理的是“266 个题会不会让用户失去耐心”，不是通过删题改变测量内容。Product v0 的题库、计分、维度、报告推断和研究状态保持不变；负担优化通过旅程设计、渐进披露、可恢复保存和更早的局部价值来完成。

## 基线

- 题库：266 个 parent tasks。
- response fields：307 个。
- 核心洞察：C1–C6，共 6 段。
- 补充决策：ENTRY_FACTS、L3 Operating Model、L4 Partner Decision、L5 Life Design，共 4 段。
- 运行时公开为 10 段旅程；L5 的内部兼容 key `PART_B_L5_LIFE_PLAN` 对用户显示为 `LIFE_DESIGN`，不改变 scoring key。

## 负担策略

### 1. 先给地图，再给题

首页展示当前状态、已完成段数和本段任务数。问卷头部同时给出本段 `n / total` 和全局完成度；所有数字都来自 runtime bundle，不写死“6 章 / 100%”。

### 2. 逐段产生价值

- C1–C5：完成后给出本段洞察和下一段入口。
- C6：显示核心部分已完成，并明确“还剩 4 个部分”；此时只能查看已完成部分，不能把它包装成完整报告。
- 后 4 段：以完成确认、决策线索和下一步说明为主，完成全部 10 段后才开放完整结果。
- 中途退出：每段都有 checkpoint；回到首页可以继续当前任务，而不是重新开始。

### 3. 把错误变成可行动的提示

- 必答题点击继续时，CTA 不进入无响应的 disabled 死路；页面在原题位置显示内联提示并滚动定位。
- 多选题在题干附近说明选择数量规则。
- 可跳过的自由文本为空时记录明确的 missingness，不把空字符串当成有效回答。
- 输入失焦即保存，保存状态使用“本机已保存 / 正在同步 / 已同步 / 仅本机 / 同步失败可重试”等可理解文本。

### 4. 允许纠错，降低一次性决策压力

- 结果页提供答案复核页，按 10 段组织已回答题目。
- evidence 带有精确 `taskId`/`itemId`，可以直接编辑对应题目。
- 修改不覆盖旧回答事件；写入新 answer event，重算 report，并递增 `reportVersion`。
- 返回结果时保留 `returnTo`，避免用户迷失在题库中。

## 不删除题目的理由

这版问卷的完整性依赖跨章节模式、14 个维度和后续决策线索。删除题目会改变缺失性判断、证据覆盖和报告语义，必须作为新的 instrument/questionnaire/scoring 版本单独研究，不能在 UX 重构中悄悄完成。

若未来需要减少负担，应另开版本化研究：预注册删减候选、保留原版对照、检查维度信度与缺失率，再由独立的 instrument 变更评审决定是否发布。

## 需要观察的指标

只记录低敏的流程指标和版本字段，不记录原始回答、自由文本、姓名或手机号：

- 开始与恢复：`assessment_start`、`assessment_restore_start`、`assessment_restore_success`、`assessment_restore_fail`。
- 负担与流失：`section_start`、`section_complete`、`section_pause`、`checkpoint_continue`、当前 section/index。
- 纠错：`answer_edit_start`、`answer_edit_open`、`answer_edit_complete`、`final_result_view`。
- 反馈：`assessment_feedback`、`assessment_feedback_skip`，仅记录目标类型、目标 id、选项、原因码、`contentVersion` 和问卷版本。
- 技术恢复：本地保存、云同步失败、冲突选择和离线继续状态。

首轮观察问题：

1. 哪一段的 pause/退出率最高？
2. 必答题错误是否集中在某种题型或某个 section？
3. 用户是否在看到局部洞察后继续完成下一段？
4. 修改回答后是否能成功回到结果，还是在编辑闭环中流失？
5. 同步失败或冲突是否导致重复答题、覆盖或放弃？

## 版本化规则

任何改变题目、response field、missingness、scoring、维度或报告推断的工作，都必须同时更新：

- questionnaire/instrument version；
- scoring model version；
- report rule/content version；
- cloud validation 与生成文件；
- 对照测试、迁移策略和新的 release acceptance。

仅调整 layout、copy、progress、checkpoint、restore、feedback 或 edit route，可以沿用 Product v0 的测量版本，但仍须运行 `npm run sync:release` 和完整回归。
