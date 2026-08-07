# 关系说明书问卷与评价规格 v2.1

版本：2.1.1-pilot
状态：受控试点开发规格  
唯一题目来源：shared/assessment/schema.js

## 产品边界

公开小程序只生成个人关系说明书：结构化回答、阶段发现、完整报告、判断依据、本人核对和修正。用户不需要留下联系方式即可获得完整报告。

公开端不提供候选浏览、双人比较、对象推荐、匹配分数、联系方式交换、聊天或自动进入任何资源池。后续访谈、模型研究和线下活动必须通过单独的用途说明与授权。

## 测量身份

本版本是参考关系科学研究设计的自编探索，不是经过本地信效度验证的心理量表，不作心理诊断，不输出依恋类型、人格类型、匹配百分比或关系成功预测。

| 模块 | 维度 | 解释范围 |
| --- | --- | --- |
| 当前状态 | readiness_intent | 当前是否愿意开始并投入长期相处方向的关系 |
| 当前状态 | autonomous_motivation | 动力更多来自本人愿望还是外部压力 |
| 当前状态 | available_capacity | 近期时间、情绪余力和基本联系能力 |
| 亲密互动 | uncertainty_sensitivity | 面对回应变化和关系未明确时的敏感 |
| 亲密互动 | closeness_discomfort | 对脆弱、依赖和持续亲近的不适 |
| 相处档案 | response_predictability | 重要话题的说明、回应与回来继续 |
| 相处档案 | emotional_support | 倾听、确认、陪伴和建议 |
| 相处档案 | autonomy_space | 独处、朋友、兴趣与各自安排 |
| 相处档案 | conflict_pause | 冲突升温时的暂停和重新约定 |
| 相处档案 | repair_reengagement | 冲突后的承认影响和修复重启 |

## 题目与版本

- 当前题目数：48
- 当前章节数：6，每章 8 题
- instrumentVersion：2.1.1-pilot
- scoringRuleVersion：serious-match-scoring-2.1.0
- reportRuleVersion：serious-match-report-rules-2.1.0
- hypothesisRuleVersion：serious-match-interview-rules-1.0.0
- 题目 ID、文字、量尺、构念、角色、侧别和 reverseScored 均以 schema.js 为准。
- 2.1 对 RMV03 的题干使用“我现在考虑开始一段关系，部分原因是想减少家人、年龄或周围环境带来的压力”，不再使用“参加登记”表述。

客户端和云函数不得维护手写副本。运行 npm run sync:assessment 后，生成文件必须与 shared/assessment/schema.js 字节一致；CI 和 npm test 会检查哈希、题目 ID、章节顺序、反向计分和版本。

## 计分

- 原始回答使用 1-5；NA 和 SKIP 表示缺少证据，不转换为中间分。
- 反向题使用 6 - rawValue。
- 反映性维度至少需要 3 个有效回答；不足时标记 insufficient。
- 需要/提供档案分别计算 needState 和 provideState，不计算总分，也不计算需要与提供的数值差。
- 质量检查只产生 normal、review_recommended、limited_evidence，不使用户或整份报告失效。

## 报告与证据

每条结论必须能回指到具体题目 ID，并保留：

- 支持证据
- 相反证据
- 限定/情境证据
- 缺失证据
- 适用边界
- 替代解释
- 待核对问题
- instrument、scoring、report 和生成时间版本

报告只能描述当前回答支持的倾向，不能把状态写成固定人格或心理诊断。用户核对和修正必须追加事件，不能覆盖历史反馈。

## 研究边界

后续访谈应先查看事实和用户明确提供的背景，再查看系统假设；访谈结果以不可变 validation event 保存。第一版使用确定性规则和固定文案，不使用不可复现的生成式 AI 直接输出最终结论。

2.1.1 对 `ASN02` 和 `CPN02` 的题干做了语义校准，使 N5 量尺继续表示“关系中的需要”，不再把接受程度误写成需要程度。详细理论依据和早期题目草案保存在 QUESTIONNAIRE_SPEC_LEGACY.md，仅用于研究追溯，不作为当前实现输入。
