# Relationship Feature Model V3
## Pilot Blueprint v0.1
### 从 Mother Measurement Bank 到第一轮可采集研究数据

> **日期**：2026-08-09
> **状态**：Research Implementation Draft
> **前置依赖**：
>
> - `relationship_manual_v3_master_construct_registry_v0.1.yaml`
> - C1/C2/C3/C4/C5/C6 Mother Banks v0.1
> - L3/L4/L5 Mother Banks v0.1
>
> **本文件解决的问题**：
>
> 1. 第一轮到底让谁做哪些东西？
> 2. Mother Bank 几百个候选交互如何在不压垮单个用户的前提下获得数据？
> 3. 哪些题所有人都做，哪些随机抽测，哪些按条件展开？
> 4. 哪些 construct 用 factor analysis，哪些根本不应该看 alpha？
> 5. 哪些结果可以给用户，哪些暂时只能研究后台看？
> 6. 什么条件下一个 candidate item / construct 才能进入下一版？
>
> **关键原则**：
>
> ```text
> PILOT QUESTIONNAIRE != FINAL PRODUCT QUESTIONNAIRE
>
> PILOT PURPOSE:
> learn what works
>
> NOT:
> prove our original design was correct
> ```

---

# 1. Pilot 的总体结构

建议不要把 V3 Pilot 当一次问卷完成。

采用五阶段研究程序：

```text
P0  Cognitive Interview
    先验证“人到底怎么理解这些题”

P0.5 Technical / UX Pilot
    验证小程序流程、branch、掉线、时长和数据写入

P1  Broad Measurement Pilot
    大样本测题目结构、分布、重复、构念边界

P2  Retest + Deep Interview
    看哪些东西稳定、为什么答、真实经历是否支持

P3  Revealed Choice / Matchmaking Follow-up
    看 stated preference 是否进入真实选择

P4  Dyadic Event Program
    真正出现具体 A-B 后验证 support / uncertainty / conflict / attraction
```

不要跳过 P0 直接跑大样本。

---

# 2. 为什么采用 Planned Missing / Matrix Sampling

Mother Bank 已经有数百个候选交互。

科学优先并不意味着：

> 每个参与者必须把所有题都做完。

第一轮推荐：

```text
COMMON SPINE
所有人完成的一小组关键 anchor

+

RANDOMIZED RESEARCH BLOCKS
随机分配候选题

+

ADAPTIVE BRANCHES
只有符合条件的人展开

+

VALIDATION SUBSETS
随机一部分人做成熟量表 / 对照任务
```

结果：

> 每个参与者只看到完整 Mother Bank 的一部分，但整个样本共同覆盖全部候选题。

这是 intentionally planned missingness，不是数据收集失败产生的 accidental missingness。

---

# 3. 两种 Pilot 身份必须分开

## Research Pilot

目标：

```text
测量学
构念验证
题目删改
```

特点：

- 更长；
- 明确说明是研究版；
- 可以出现重复/相似 candidate items；
- 可以使用随机 form；
- 可以做 retest / interview；
- 最好对时长和额外研究负担给予适当补偿或激励。

## Product Beta

目标：

```text
产品体验
完成率
报告价值
留资 / 后续访谈意愿
```

特点：

- 更短；
- 只使用已经初步筛选的 item；
- 不应让普通用户承担整套测量开发负担；
- 报告必须明确哪些仍是 Pilot conclusion。

**不要用同一套问卷同时最优化 psychometric coverage 和公开完成率。**

---

# 4. P0 — Cognitive Interview

## 4.1 推荐形式

使用：

```text
think-aloud
+
retrospective probing
+
paraphrase
+
response-process probing
```

不是问：

> “这题你觉得好吗？”

而是：

```text
“你刚才看到‘稳定关系’时理解成什么？”

“你选择这个选项时脑子里想到的是哪段经历？”

“‘自己待一会儿’对你是几个小时还是几天？”

“这两道题在你看来是不是问同一件事？”
```

---

# 5. P0 建议样本

规划目标：

```text
3 waves
×
8–12 people per wave
=
approximately 24–36 participants
```

这个数字是**研发规划目标**，不是任何统计学“最低有效样本”的宣称。

每一波：

```text
发现问题
→ 改 wording / options
→ 下一波重新验证
```

比一次做 30 人后统一改题更有效。

---

# 6. P0 样本覆盖

第一批大连用户至少有意识覆盖：

```text
gender
age band
relationship history
never had serious relationship
recently single
long-term single
currently casually dating
work intensity
education background
```

目的不是人口代表性推断。

而是：

> 尽早发现同一句题在不同用户中被理解成完全不同任务。

---

# 7. P0 必须重点检查的词

当前 Mother Bank 中最危险的高层词：

```text
认真关系
稳定关系
投入
亲密
依靠
空间
支持
理解
冷淡
关系变得不确定
上进 / ambition
家庭
公平
隐私
排他
硬条件
可以接受
```

任何一个词如果用户解释差异过大：

> 必须行为化，不要靠术语本身。

---

# 8. P0 通过标准

一题可以进入 P1，不要求“大家都喜欢”。

最低要求：

```text
用户知道在回答什么
响应选项覆盖真实答案
没有明显双重问题
没有隐藏默认情境
没有明显道德正确答案
不会系统性诱发羞耻/防御
归属 construct 基本合理
```

---

# 9. P0.5 — Technical / UX Pilot

目标人数可先：

```text
50–100
```

重点不是 psychometrics。

看：

```text
branch logic error
题目重复
页面加载
断点续答
选项长度
场景阅读疲劳
移动端点击
跳题是否正确
数据字段是否完整
随机 form 是否均衡
```

---

# 10. P0.5 必须记录 Event Telemetry

每个交互：

```yaml
questionEvent:

  participantId: ...
  itemId: ...

  shownAt: ...
  answeredAt: ...

  responseTimeMs: ...

  changedAnswerCount: ...

  skipped: false

  branchPath: ...

  researchForm: ...

  appVersion: ...
  itemVersion: ...
```

不要只保存最后答案。

---

# 11. Response Time 只作为 Quality Signal

禁止：

```text
回答快 = 不认真
```

可以用于：

```text
极端 fast responding
长停顿
技术问题
```

并与其他质量指标一起判断。

---

# 12. P1 — Broad Measurement Pilot

P1 是第一轮真正的大样本。

当前建议规划：

```text
minimum practical launch target:
~500 complete / usable participants

preferred initial target:
~800–1,200

```

这不是“500/800 是任何 CFA 的万能最低样本”。

最终需要根据：

```text
每个 construct 的 item 数
factor complexity
planned missing rate
ordinal response distribution
missingness
model estimator
expected loading
subgroup comparison
```

再做 power / simulation。

当前这些数字只是为了项目组织和 item-level coverage 预留空间。

---

# 13. 为什么初期目标不应该只有 100 人

V3 同时要做：

```text
多 construct
random item forms
relationship-history branches
some subgroup checks
test-retest recruitment
```

如果总 N 很小：

> 每一道 random candidate item 实际拿到的数据会迅速变得很少。

因此不要让：

```text
“问卷很长”
```

成为压缩科学结构的理由。

应该用：

```text
更大样本
+
planned missing
```

解决。

---

# 14. P1 Participant Eligibility

当前第一批业务环境：

```text
18+
unmarried / single
currently living in Dalian
able to provide informed responses
```

研究数据库还要记录：

```text
currentDatingStatus
relationshipHistory
lastRelationshipTime
```

因为 C3–C6 的证据质量明显依赖实际经历。

---

# 15. P1 Form Architecture

建议采用：

```text
COMMON SPINE
+
FORM A/B/C
+
CONDITIONAL BRANCHES
```

示意：

```text
                  ┌── FORM A
COMMON SPINE ─────┼── FORM B
                  └── FORM C
```

每个人只随机进入一个主 research form。

---

# 16. Common Spine 的任务

Common Spine 不负责完整测量所有 construct。

它负责：

```text
participant eligibility
essential facts
routing variables
2–3 anchor items per key construct
high-value life-plan fields
basic operating standards
basic preference positions
quality / safety boundaries
```

并建立 forms 之间的 statistical bridge。

---

# 17. Common Spine v0.1 内容建议

## A — Eligibility / Context

约：

```text
6–10 interactions
```

包括：

```text
age
gender
current district / city
single confirmation
relationship history
current dating context
```

---

## B — C1/C2 Bridge Items

约：

```text
10–12
```

优先：

```text
readiness anchors
motivation mini anchors
capacity facts
follow-through anchor behavior
```

---

## C — C3–C6 Bridge Items

约：

```text
16–20
```

每个主要 construct：

```text
1–2 high-content anchor
+
context / relationship-history flag
```

例如：

```text
uncertainty activation 2
regulation 2
intimacy 2
space 2
support need 2
signaling 2
responsiveness 2
conflict 2
repair 2
```

不是正式 short form。

只是研究 bridge。

---

# 18. Common L3 Core

约：

```text
8–12 interactions
```

优先：

```text
contact frequency / predictability
ambiguity window
shared time
conflict pause procedure
money basic governance
family boundary basic
exclusivity / relationship structure
```

---

# 19. Common L4 Core

约：

```text
8–12 interactions
```

优先：

```text
character floor
physical broad range
resource minimum
intellectual level
social range
exploration range
ambition range
family orientation
```

深层 trade-off 放 form block。

---

# 20. Common L5 Core

约：

```text
8–12 interactions
```

必须：

```text
children
marriage
relationship structure
current / future city
smoking
major hard constraints
```

---

# 21. Common Spine 总体负担

建议目标：

```text
about 50–65 interaction units
```

注意：

> `interaction unit` 不等于传统一题。

一个 scenario 可能包含：

```text
read
→ activation rating
→ strategy choice
```

应通过实际 median completion time 校准，而不是机械按 item count。

---

# 22. FORM A — Psychometric / Reactive Systems

重点：

```text
relationship_readiness candidate pool
motivation candidate pool
uncertainty_activation
intimacy_dependence
conflict_activation
```

随机分配额外：

```text
25–35 interaction units
```

---

# 23. FORM B — Needs / Capabilities

重点：

```text
follow-through
personal space
support need
support signaling
responsiveness scenarios
conflict pacing
repair
```

约：

```text
25–35 extra units
```

---

# 24. FORM C — Decision / Operating Systems

重点：

```text
L3 deeper standards
L4 preference ranges
trade-off profiles
L5 promotion probes
```

约：

```text
25–35 extra units
```

---

# 25. 每人 P1 总负担

目标：

```text
Common 50–65
+
Form 25–35
=
roughly 75–100 interaction units
```

预计时间必须由 P0.5 实测。

研究版可以比最终产品长很多。

如果实测出现：

```text
fatigue
response speeding
dropout
```

优先：

```text
继续拆 forms
```

而不是：

```text
删除科学上必要的 construct
```

---

# 26. Form 内进一步 Planned Missing

例如 FORM A 中：

```text
uncertainty activation
```

有 14 general candidates。

不要求每人 14 个全做。

可设计：

```text
4 anchor items everyone in Form A
+
remaining 10 randomly split into 2 blocks
```

使：

```text
每个 participant 8–9 items
整个 sample 覆盖 14
```

同理：

```text
intimacy
conflict
motivation
```

---

# 27. 不能完全随机到“没有桥”

每个 construct 应保留：

```text
COMMON ANCHORS
```

否则：

> 不同 form 完全没有共同 item，后续连接和测量比较会困难。

---

# 28. Relationship-history Branch

## 有近期真实关系经历

增加：

```text
behavioral history
actual conflict/support examples
```

并降低纯 hypothetical scenario 比例。

## 没有足够经历

增加：

```text
scenario
```

但：

```text
evidenceStatus = PROVISIONAL
contextBasis = HYPOTHETICAL
```

不得给同等置信度。

---

# 29. Salience Branch

适用于：

```text
religion
worldview
political / moral issues
digital privacy deep
cultural aesthetic
certain family issues
```

先问：

```text
Does it materially affect partner choice?
```

低：

```text
skip
```

高：

```text
deep module
```

---

# 30. Life-stage Branch

例如：

```text
children = definitely no
```

则：

```text
Parenting Operation
NOT_APPLICABLE
```

不要逼用户回答假想夜间育儿分工。

---

# 31. Position-confidence Branch

用户：

```text
“我几乎没想过共同账户”
```

系统不要继续追 8 个细节题。

低 confidence：

```text
record uncertainty
skip deep implementation
```

这本身就是数据。

---

# 32. Validation Anchor Subsets

成熟量表 / 外部 construct 不要全塞给所有人。

随机 subset 做。

候选：

```text
Commitment Readiness anchor
AMRPS
attachment anxiety / avoidance anchor
PPR — only when actual partner exists
general uncertainty / rumination discriminant
Big Five facets — only for discriminant validation
```

使用前必须检查：

```text
license
translation status
appropriate population
```

---

# 33. Validation Form V1

例如随机：

```text
20–30% participants
```

进入额外 anchor block。

目标不是给他们产品结果。

用于：

```text
convergent validity
discriminant validity
```

---

# 34. Random Validation Probe

某些有污染风险的 boundary item 只随机给部分用户。

例如：

```text
social engagement vs assertiveness
exploration vs risk-taking
space vs introversion
activation vs general uncertainty
```

不需要进所有人的正式报告。

---

# 35. P1 数据质量 Flags

不要一个规则直接删人。

建立：

```yaml
qualitySignals:

  duplicatePattern: ...
  implausiblyFast: ...
  excessiveStraightlining: ...
  inconsistentAttentionCheck: ...
  impossibleFactCombination: ...
  veryHighMissing: ...
  branchTechnicalError: ...
```

最终：

```text
KEEP
KEEP_WITH_FLAG
EXCLUDE_FROM_SPECIFIC_ANALYSIS
EXCLUDE
```

需要分析计划预先定义。

---

# 36. Attention Check 原则

不要用侮辱式：

> “为了证明你认真，请选非常同意。”

少量使用即可。

更推荐：

```text
response consistency
timing
impossible combinations
```

综合判断。

---

# 37. P1 Psychometric Analysis Map

只有这些类型考虑 factor model：

```text
relationship_readiness
initiation_motivation
uncertainty_activation
intimacy_dependence_comfort
possibly conflict_activation
possibly follow-through higher-order structure
```

---

# 38. 不做统一 factor analysis 的对象

```text
capacity
support need forms
personal space range
L3 operating standards
L4 physical / resource ranges
L5 life plans
hard constraints
```

这些本来就不是反映式 latent scale。

---

# 39. Factor Workflow

对自建 psychometric pool：

```text
item distribution
↓
polychoric / ordinal-aware analysis as appropriate
↓
EFA / exploratory structure where genuinely open
↓
holdout / later sample CFA
↓
factor score / IRT only if justified
```

不要：

```text
同一批数据疯狂 EFA 后马上 CFA
→ 宣称 confirm
```

可以在 P1 内：

```text
split sample
```

但更理想是 P1 exploratory、后续 cohort confirm。

---

# 40. Item Retention 不只看 Loading

保留一个 item 的理由至少包括：

```text
construct coverage
loading / discrimination
cross-loading
response distribution
social desirability
test-retest
user comprehension
redundancy
decision utility
```

---

# 41. “Alpha 很高”不能保住坏题

例如：

```text
10 道几乎重复的题
```

可能 alpha 很高。

但：

> 内容覆盖很差、用户体验很差。

所以：

```text
internal consistency
```

只是信息之一。

---

# 42. Strategy Profile Analysis

例如：

```text
uncertainty_regulation
```

第一轮不要强制：

```text
8 strategies → 1 general score
```

看：

```text
strategy frequencies
scenario-dependent transitions
co-occurrence
latent profile only if theoretically justified
```

---

# 43. P1 Preference Analysis

L4 重点不是 alpha。

分析：

```text
ideal position distribution
acceptable range width
lower mismatch cost
upper mismatch cost
salience
trade-off choices
```

---

# 44. Preference Function Minimum Data

Horizontal attribute 最低：

```text
ideal
acceptable lower
acceptable upper
salience / mismatch cost
```

如果用户不能可靠回答：

> 该 attribute 不应进入精细 matching function。

---

# 45. P1 L3 Analysis

每个 Standard 看：

```text
response distribution
unknown rate
position confidence
retest
reciprocity
rationale
decision utility
```

高 unknown 不一定说明题差。

也可能说明：

> 用户在单身阶段确实还没有形成 position。

此时更适合：

```text
interview / later-stage
```

而不是强迫答案。

---

# 46. P1 L5 Analysis

重点：

```text
DESIRE != INTENTION
UNSURE decomposition
hardness confirmation
time horizon
```

不看“Life Plan alpha”。

---

# 47. P2 — Retest

建议第一轮：

```text
2–4 weeks
```

邀请：

```text
~200–300 usable repeats
```

这也是项目规划目标，不是通用硬阈值。

---

# 48. Retest 不要求所有对象高度稳定

预期不同：

```text
attachment-like / reactive tendency:
higher

preference:
moderate-to-high but not permanent

operating standard:
domain-specific

readiness:
can change

motivation:
can change

capacity:
expected to change

life plan:
confidence-dependent
```

所以：

> `capacity changed` 不能叫 reliability failure。

---

# 49. Retest 必须同时问 Change Event

例如：

```text
过去两周有没有：
开始约会
结束接触
工作变化
搬家
家庭事件
健康事件
```

否则：

> 无法区分 measurement instability 和真实 state change。

---

# 50. P2 Deep Interview

建议：

```text
60–100
```

按 profile stratified sampling。

不是只挑“典型用户”。

要刻意找：

```text
high-low combinations
apparent tensions
low confidence
hypothetical-only
asymmetric standards
stated hard conditions
```

---

# 51. Interview 的任务

不是：

> 让用户评价报告准不准。

重点：

```text
construct interpretation
behavior history
rationale
edge cases
unknowns
why a trade-off choice happened
why hard constraint is hard
```

---

# 52. “像不像你”不作为主要 validation

用户对漂亮描述产生共鸣：

> 不是 construct validity。

可以采集产品满意度，但科学验证更依赖：

```text
retest
anchor construct
behavior
interview
revealed choice
dyadic experience
```

---

# 53. P3 — Revealed Choice Program

当真正开始人工撮合：

每个 candidate impression 保存：

```yaml
candidateChoiceEvent:

  userId: ...
  candidateId: ...

  infoShown:
    - ...

  stage:
    profile
    photo
    intro
    chat
    meeting

  userDecision:
    continue
    decline
    unsure

  reasons:
    ...

  initiatedByUser:
    ...

  timestamp:
    ...
```

---

# 54. Revealed Preference 不等于 True Preference

它仍然受到：

```text
available candidate pool
presentation
photos
timing
market constraints
```

影响。

所以：

```text
REVEALED
```

只是另一层 evidence。

不是：

> “真实偏好终于揭晓”。

---

# 55. P3 最重要的分析

```text
stated ideal
→ actual candidate choice

stated range
→ actual acceptance

stated hard
→ actual rejection

trade-off priority
→ candidate selection

salience
→ real choice sensitivity
```

---

# 56. P4 — Dyadic Program

真正出现具体 A-B 后。

至少建立四类 Event Bank：

```text
uncertaintyEvent
supportEvent
conflictEvent
attraction / continuationEvent
```

---

# 57. P4 Uncertainty Event

记录：

```text
actual ambiguity trigger
prior baseline
activation
interpretation
strategy
partner response
resolution
```

用于验证 C3。

---

# 58. P4 Support Event

记录：

```text
seeker need
signal clarity
provider response
recipient perceived responsiveness
```

用于验证 C5：

```text
Need → Signal → Provision → Experience
```

---

# 59. P4 Conflict Event

记录：

```text
topic
desired change
activation
pacing
pause
return
repair
outcome
```

用于验证 C6/L3。

---

# 60. P4 Attraction / Continuation

每阶段：

```text
photo attraction
chat interest
meeting attraction
desire to continue
second date
```

用于检验：

> static L4 到底解释了多少、解释不了多少。

---

# 61. Pilot Report Policy

P1 阶段用户报告只能使用：

```text
descriptive
mechanism-oriented
uncertainty-aware
```

例如：

> 当前回答更接近……

不要：

```text
“科学验证显示你属于……”
```

---

# 62. Result Status

每一段结果带内部：

```text
PILOT_PROVISIONAL
PILOT_MEASURED
FACTUAL
LOW_CONFIDENCE
CONTEXTUAL
```

前台不必满屏显示技术标签。

但高风险能力推断要用语言体现：

> “从情境题来看……”

而不是：

> “你拥有很强的情绪支持能力。”

---

# 63. Construct Exit Criteria

一个自建 construct 应被删除 / 合并，如果出现：

```text
1. 用户不能稳定理解
2. 与现有成熟 construct 近乎完全重合
3. 没有增量 validity / decision utility
4. candidate-side 无法合理观测
5. 报告价值低
6. 真实行为预测接近零且无 self-insight 独立价值
```

---

# 64. Item Exit Criteria

候选题可删除，如果：

```text
严重 ceiling / floor
几乎人人同答
高社会赞许
与另一题重复
cross-loading 严重
边界污染无法解释
认知访谈持续误解
response burden 过高
没有 decision/research value
```

---

# 65. Construct Promotion Criteria

CANDIDATE → VALIDATED_V3_CORE 不只需要：

```text
alpha
```

至少需要相应组合：

```text
clear construct definition
response-process evidence
internal structure where relevant
convergent/discriminant validity
retest where relevant
behavior / revealed choice where relevant
incremental utility
```

---

# 66. Pilot Versioning

任何正式 P1 launch：

```yaml
studyVersion:
  pilot_v0.1

registryVersion:
  construct_registry_v0.1

itemBankVersion:
  item_bank_v0.1

reportVersion:
  pilot_report_v0.1

appVersion:
  ...
```

禁止：

> 一边收数据一边改题但 itemId/version 不变。

---

# 67. Item Version

例如：

```text
UA03_v1
UA03_v2
```

如果 wording 发生 substantive change：

> 必须新 version。

不能把不同题文本的数据直接混一起。

---

# 68. Randomization Log

每个 participant：

```yaml
assignment:

  mainForm:
    B

  validationBlock:
    attachment_anchor

  scenarioOrder:
    ...

  experimentalItems:
    [...]
```

使 planned missing mechanism 可重建。

---

# 69. Data Tables 建议

```text
participants
assessments
item_responses
scenario_events
construct_estimates
facts
operating_standards
preference_functions
life_plans
candidate_choice_events
dyadic_events
interviews
versions
```

不要一张：

```text
user_table with 600 columns
```

---

# 70. Long-format `item_responses`

```yaml
participantId: ...
assessmentId: ...

itemId: UA03
itemVersion: 1

responseRaw: 6
responseNormalized: ...

shownAt: ...
answeredAt: ...

responseContext:
  recent_relationship

researchForm:
  A
```

---

# 71. Derived Estimate 不能覆盖 Raw Data

必须保留：

```text
raw response
```

另表生成：

```text
construct estimate
```

否则 scoring 更新后无法重算历史数据。

---

# 72. Pilot Analysis Freeze

在正式查看 P1 outcome 前，至少预先冻结：

```text
primary construct hypotheses
which items are core vs probes
exclusion logic
factor-analysis decisions
retest expectations
main validity anchors
```

不是为了形式主义。

是避免：

> 看到数据以后再改故事。

---

# 73. Exploratory Analysis 可以很丰富

但标：

```text
EXPLORATORY
```

例如：

```text
新的 profile
unexpected factor
gender difference
relationship-history subgroup
```

下一批数据再 confirm。

---

# 74. Sample-size Simulation TODO

在 Master Item Registry 真正完成、P0 删完明显坏题后：

> 用实际：

```text
items per factor
expected loading
response distribution
planned missing proportion
```

做 Monte Carlo / simulation-based power planning。

**不要现在用“10人/题”这种经验法则冻结样本。**

---

# 75. Public Beta Gate

从 Research P1 进入 Public Beta 前，至少满足：

```text
严重理解问题已解决

关键 psychometric construct 有初步结构证据

用户报告不依赖未验证 hard cutoff

能力结果明确标 provisional

安全/隐私题通过产品审查

branch 正确

无明显 completion catastrophe

数据 schema 可版本化
```

---

# 76. Final Short Form Gate

只有 P1/P2 后才讨论：

```text
每个 construct 最后几题
```

规则：

> 不是“平均每个构念 3 题”。

而是：

```text
保留足够信息
+
产品负担
+
adaptive efficiency
```

共同决定。

---

# 77. Pilot v0.1 建议顺序

实际执行：

```text
NOW
Master Registry complete

↓

NEXT
Item Registry normalization

↓

P0 materials
build cognitive interview form

↓

P0
3 waves

↓

freeze P1 item candidates

↓

P0.5
technical/UX

↓

P1
broad pilot

↓

P2
retest + interviews

↓

Public Beta short form

↓

P3 / P4
real matchmaking and dyadic validation
```

---

# 78. Pilot 最大成功标准

第一轮成功不是：

> “所有假设都显著。”

而是我们能够明确知道：

```text
哪些 construct 值得留下
哪些其实重复
哪些题用户理解错
哪些 preference 真有分布
哪些 standards 现在问太早
哪些能力必须后测
哪些 static variables 对真实选择有信息
哪些东西我们就是预测不了
```

如果 Pilot 迫使我们删除自己很喜欢的一部分设计：

> 这反而说明 Pilot 在工作。

---

# 79. 当前建议的 Pilot Deliverables

P0 前：

```text
Master Construct Registry
Master Item Registry
Cognitive Interview Guide
P0 Questionnaire
Version Manifest
```

P1 前：

```text
P1 Common Spine
Form A/B/C
Validation Anchor Blocks
Randomization Spec
Analysis Plan
Data Dictionary
```

P2 前：

```text
Retest Form
Change Event Inventory
Interview Guide
```

P3/P4 前：

```text
Candidate Choice Event Schema
Dyadic Event Schemas
Follow-up Schedule
```

---

# 80. 本轮决策记录

```yaml
decision:
  plannedMissingDesign:
    use: true

  design:
    common_spine_plus_random_forms: true

  publicUsersCompleteEntireMotherBank:
    false

  pilotIsFinalProductQuestionnaire:
    false

  oneGlobalReliabilityStatistic:
    false

  oneGlobalMatchScore:
    false

  hypotheticalAndBehaviorEvidenceEqual:
    false
```

---

# 81. 下一步

本文件之后立即推进：

```text
Master Item Registry v0.1
```

工作包括：

```text
给所有 Mother Bank 交互统一 itemId
统一 responseFormat
统一 construct / facet / role
标 core / rotating / branch / dyadic-only
标 social desirability / contamination
建立 source file + version
```

完成后，Pilot Blueprint 才能从“设计规范”变成：

> **精确到 itemId 的可执行问卷清单。**
