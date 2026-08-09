# Relationship Feature Model V3
## Pilot Analysis Plan v0.1
### P0 → P4 的分析边界、保留/删除规则与 planned-missing 处理

> 日期：2026-08-09
> 状态：Pre-analysis framework / 需在 P1 正式启动前进一步冻结
> 依赖：
>
> - Master Construct Registry v0.1
> - Master Item Registry v0.2
> - Response Format Library v0.1
> - P0 Questionnaire Spec v0.1
> - P1 Form Manifest v0.2
> - Data Dictionary v0.1

---

# 1. 总原则

V3 不是一个量表，因此没有一个统一的“验证成功”。

不同数据对象分别回答：

```text
Psychometric construct
→ 能否稳定、有效地估计潜在构念？

Behavior / capability
→ 自报/情境能否与真实行为或伴侣体验对应？

Need
→ 用户能否稳定描述自己需要怎样的回应？

Operating Standard
→ 用户是否理解、具有真实立场、能否影响 pair negotiation？

Preference
→ ideal/range/trade-off 是否预测真实候选选择？

Constraint
→ stated hardness 是否在现实选择中执行？

Dyadic Event
→ 静态模型哪些地方能预测、哪些必须等真实互动？
```

---

# 2. P0 — Cognitive Interview Analysis

P0 不算 alpha。

每个题编码：

```text
COMPREHENSION
correct / partial / divergent / unclear

RETRIEVAL BASIS
recent event / old event / general self-image / hypothetical / social rule

JUDGMENT
construct-targeted / contaminated / moral answer / unclear

RESPONSE MAPPING
easy / forced / missing option

SOCIAL DESIRABILITY
low / medium / high

ACTION
keep / rewrite / split / reroute / drop
```

每波结束后立即改题。

---

# 3. P0 的 Construct Boundary Tests

重点不是“用户喜欢不喜欢题”。

必须验证：

```text
readiness vs desire vs capacity

intrinsic vs identified vs external/internal pressure

cue vigilance vs threat appraisal

actual relational uncertainty vs person activation

intimacy discomfort vs personal-space need

vulnerability vs reliance

support need vs signaling

signaling vs communication confidence

pause need vs withdrawal

reconnection vs issue resolution

ideal vs acceptable vs hard

voluntary sharing vs required access

family orientation vs parent boundary

ambition vs income/resources
```

如果用户无法稳定区分：

> 优先改构念/路由，不是换几个同义词继续问。

---

# 4. P0 Exit Gate

进入 P1 的 item 至少：

```text
没有反复出现的严重理解偏差
响应选项覆盖常见真实答案
没有明显双重问题
社会赞许风险可接受或已被场景化处理
归属 construct 合理
```

---

# 5. P0.5 — Technical Analysis

只看：

```text
completion
drop-off by block
response time
backtracking
answer-change rate
branch errors
missingness-code correctness
device/app failures
```

禁止：

> 用 P0.5 小样本提前决定心理测量结构。

---

# 6. P1 Planned Missingness

P1 v0.2：

```text
57 common parent tasks
+
A/B/C one randomized research form
+
adaptive branches
+
validation subsets
```

经典 planned-missing / three-form 研究说明，研究者可以通过设计性缺失减少个体负担，同时覆盖更大项目集合。

V3 的实现不是机械复制经典 3-form，而是遵守：

```text
assignment known
missingness intentional
common anchors present
randomized/recorded assignment
appropriate missing-data analysis
```

---

# 7. Missingness 分类

分析前绝不把所有 null 合并。

```text
NOT_SHOWN_BY_DESIGN
NOT_APPLICABLE
USER_SKIPPED
TECHNICAL_MISSING
UNKNOWN
```

其中：

```text
NOT_SHOWN_BY_DESIGN
```

是研究设计的一部分。

---

# 8. Planned Missing 的分析处理

最终方法取决于具体模型与软件。

原则上考虑：

```text
full-information estimation where model/estimator supports it
multiple imputation when appropriate
model-based handling of designed missingness
```

对 ordinal item：

> 不能为了方便统一转成连续正态变量后无视分布。

正式 P1 前需要用拟定 item 数、loading、类别分布和缺失比例做 simulation。

---

# 9. P1 Psychometric Construct Set

优先结构验证：

```text
relationship_readiness

initiation_motivation

uncertainty_activation

intimacy_dependence_comfort

conflict_activation
```

探索：

```text
relational_follow_through higher-order structure
```

但 follow-through 的行为 facet 即使不能聚成单因子也可保留。

---

# 10. 不允许做统一 Reflective Factor Model 的对象

```text
available_capacity

personal_space_need if implemented as concrete range/profile

support_need forms

uncertainty strategy profile

conflict pacing need

L3 Operating Standards

L4 preference ranges

L5 plans / constraints
```

这些对象的“项目彼此不高度相关”可能是设计正确，而不是量表失败。

---

# 11. Psychometric Item Screening

逐 item 看：

```text
category usage
floor/ceiling
missing/skipped
response time
item-rest relation
polychoric relation where relevant
cross-loading
local dependence / redundancy
wording method effects
```

不使用：

```text
loading < 某统一神奇阈值 → 自动删除
```

需要结合 construct coverage。

---

# 12. EFA / CFA 纪律

对于真正开放结构：

```text
EFA / exploratory model
```

对于已有明确理论锚并且项目已相对成熟：

```text
CFA / comparison models
```

尽量：

```text
exploration and confirmation use independent data
```

若同一 P1 cohort 必须拆样本：

> 明确标记 split-sample confirmation，而不是把同一数据反复调模型后仍称 confirmatory。

---

# 13. Reliability

允许：

```text
omega / appropriate reliability for latent constructs
test-retest
```

但不把一个 alpha 当 validity。

特别禁止：

```text
V3 total alpha
L3 total alpha
L5 total alpha
```

概念上没有意义。

---

# 14. Relationship Readiness

检查：

```text
factor structure
convergent with mature commitment readiness anchor
discriminant from desire, external pressure, capacity
```

后续：

```text
willingness to meet
active pursuit
relationship entry
```

只是预测 criterion，不是“高分更好”。

---

# 15. Initiation Motivation

首要比较：

```text
six-factor / correlated structure
```

与 AMRPS 直接理论结构保持可比较。

探索：

```text
external_family
external_peer_timeline
```

是否在中国样本中提供独立信息。

不先构造：

```text
one moral autonomy score
```

---

# 16. Uncertainty Activation

必须与：

```text
attachment anxiety
general intolerance of uncertainty
general rumination
actual relational uncertainty
```

比较。

关键退出问题：

> 控制成熟 attachment anxiety 后，V3 activation 是否对 early-dating ambiguity event 有增量解释？

若没有：

> 考虑采用成熟构念或合并。

---

# 17. Uncertainty Regulation

不做单总分。

看：

```text
strategy frequency
scenario-specific switching
first move
escalation sequence
co-occurrence
```

如果后续采用 latent profile/class：

> 必须是探索性的，并在独立样本复现；不能因为软件能跑就创造“8种恋爱人格”。

---

# 18. Intimacy / Dependence

以 attachment avoidance 为主要 anchor。

检查：

```text
emotional closeness
vulnerability
reliance
receiving care
```

是否：

```text
一根高阶因子
+
有实用 facet
```

或其实完全等价于 attachment avoidance。

---

# 19. Personal Space

验证目标：

```text
space need
!=
attachment avoidance
!=
introversion/social recovery
!=
L3 shared-time rule
```

一个重要 empirical prediction：

```text
high intimacy comfort
+
high personal space need
```

应真实存在。

---

# 20. Support Need

不优先做 factor model。

重点：

```text
context-specific rank/order
test-retest of support-form preferences
sequence preference
experienced response fit
```

例如：

```text
work failure
vs
decision
vs
illness
```

如果不同，不是测量失败。

---

# 21. Support Signaling

检查：

```text
disclosure
request directness
request specificity
indirect signaling
concealment
```

与：

```text
vulnerability comfort
assertiveness
attachment
```

的区分和增量。

---

# 22. Responsiveness Capability

P1 只允许：

```text
scenario capability = provisional
```

主要 criterion 留到 P2/P4：

```text
interview behavior examples
partner-perceived responsiveness
real support event
```

关键：

> scenario 里“知道正确答案”能否预测现实调整能力？

---

# 23. Conflict Activation

验证：

```text
high activation
```

与：

```text
anger
general distress
conflict frequency
```

是否区分。

若使用 flooding anchor：

> 只能称 convergence with self-reported flooding，不能声称测量生理 flooding。

---

# 24. Conflict Pacing

重点：

```text
preferred pause timing
test-retest
actual conflict pause
```

不需要 alpha。

---

# 25. Repair / Re-engagement

重点检验：

```text
pause signal
return execution
reconnection
issue re-engagement
```

特别测试：

```text
return_execution
```

是否只是 C2 general follow-through。

若高度重复且无增量：

> 不重复保留两个“可靠性分数”。

---

# 26. L3 Operating Standards

每个 domain 看：

```text
response distribution
UNKNOWN rate
position confidence
retest
negotiability
reciprocity
pair discussion utility
```

用户“不知道”可能说明：

> 这个问题在单身 onboarding 阶段问得过早。

可能迁到：

```text
later relationship stage
interview
```

---

# 27. Reciprocity

分析：

```text
partner rule
vs
self accepted rule
```

状态：

```text
symmetric
contextually asymmetric
unexplained asymmetric
unknown
```

不要直接创造：

```text
double-standard score
```

---

# 28. L4 Preference Functions

每个横向 attribute 看：

```text
ideal distribution
acceptable-range width
left/right mismatch sensitivity
position confidence
retest
trade-off choice
revealed candidate acceptance
```

---

# 29. Normative Desirability

全球 ideal-partner preference matching 研究提醒：

> 一部分所谓“匹配”来自普遍大家都喜欢的属性，而不是独特的个人偏好。

因此后续 pair/predictive analysis 要区分：

```text
normative desirability
vs
distinctive preference satisfaction
```

不能把“大家都喜欢诚实可靠的人”包装成个性化算法成功。

---

# 30. Trade-off

分析：

```text
choice consistency
attribute marginal value
rating-to-choice divergence
retest
revealed choice prediction
```

不建立永久：

```text
weight = 0.27
```

---

# 31. Stated Hard Constraint

比较：

```text
stated hardness
counterfactual confirmation
revealed candidate choice
repeated choice
```

运营规则始终：

> 当前明确 hard constraint 必须尊重。

研究层不能用“你以后可能改”覆盖当下同意边界。

---

# 32. L5 Life Plans

不算 alpha。

重点：

```text
desire/intention separation
uncertainty reasons
position confidence
time horizon
retest / true change
pair alignment
```

---

# 33. P2 Retest

目标不仅是相关系数。

必须同时记录：

```text
change events
```

然后区分：

```text
measurement instability
vs
real state/context change
```

---

# 34. Time-sensitive Construct Expectations

```text
capacity
→ expected to change substantially

readiness/motivation
→ medium stability

attachment-like tendencies
→ higher stability

preferences
→ stability + genuine change

life plans
→ confidence/life-stage dependent
```

---

# 35. P2 Interview Validation

抽样不能只选“高分典型”。

需要覆盖：

```text
high-high
high-low
low-high
low-low
low position confidence
hypothetical-only
asymmetric standards
stated-hard / tradeoff-soft
```

---

# 36. P3 Revealed Choice

主要分析：

```text
stated preference → candidate continuation
range → acceptance
hard → rejection
tradeoff → selection
salience → behavioral sensitivity
```

控制/记录：

```text
what information was shown
photo availability
candidate pool restriction
stage
timing
```

否则所谓 revealed preference 也会被 exposure confound。

---

# 37. P4 Dyadic Validation

四条重点链：

```text
C3:
uncertainty exposure → activation → strategy → partner response

C5:
need → signaling → provision → perceived responsiveness

C6:
activation → pacing → procedure → return → repair → outcome

L4:
static preference → actual attraction / continuation
```

---

# 38. Pair Engine Validation

不验证：

```text
“Match Score correlates with happiness”
```

因为 V3 不应先造总 Match Score。

先验证组件：

```text
hard-constraint screening precision
high-value unknown identification
directional preference satisfaction
need-to-provision hypotheses
operating-standard discussion utility
```

---

# 39. Decision Utility

对人工运营尤其重要：

比较使用 V3 前后：

```text
operator time to understand participant
number of clarifications needed
candidate introductions accepted
mutual continuation
avoidable hard-conflict introductions
high-value interview questions
```

这是独立于 psychometrics 的产品效用。

---

# 40. Multiple Testing / Exploration

P1 会有大量 exploratory comparisons。

必须：

```text
pre-label primary vs exploratory
report effect sizes + uncertainty
avoid significance mining
use later cohort for confirmation
```

不能从几十个偶然显著结果里挑故事。

---

# 41. Subgroup / Invariance

只有样本量和理论价值允许时检查：

```text
gender
relationship-history
current dating status
age band
```

Measurement invariance 不能为了论文完整性机械全跑。

优先问：

> 同一个 item 在不同群体是不是被理解成不同情境？

P0 qualitative evidence先行。

---

# 42. Sample Size

P1 的 500 / 800–1,200 目前只是 operational planning target。

正式分析样本要根据：

```text
planned missing rate
items per factor
number of categories
expected loadings
factor correlations
subgroup need
attrition
```

做 simulation。

不采用：

```text
10 people per item
```

作为唯一依据。

---

# 43. Construct Promotion

CANDIDATE → V3 CORE 至少需要与该对象匹配的证据组合。

可能包括：

```text
response-process
internal structure
convergent
discriminant
retest
incremental
behavioral criterion
decision utility
```

不是每种 construct 都要求全部同一套。

---

# 44. Construct Demotion

如果一个对象：

```text
无法理解
严重社会赞许
完全被成熟 construct 吸收
candidate-side 不可观测
真实选择无信息
报告/访谈也无独立价值
```

则：

```text
DROP
MERGE
RESEARCH_ONLY
INTERVIEW_ONLY
```

都可以。

---

# 45. Reporting Discipline

所有 P1/P2 初步发现：

```text
PILOT
```

不得写：

> “科学证明 V3 可以预测长期匹配。”

更准确：

> “在当前 Pilot 样本中，这组回答表现出……；后续需要独立样本/真实互动验证。”

---

# 46. 方法学锚点

## Planned Missing

Graham, Taylor, Olchowski & Cumsille (2006).
**Planned Missing Data Designs in Psychological Research.**
*Psychological Methods.*

核心用途：

> three-form / matrix-sampling 作为降低单个参与者测量负担、覆盖更多测量内容的设计框架。

## Experience-sampling simulation

Silvia et al. (2014).
Planned missing designs in experience sampling 的 Monte Carlo 研究显示，在所研究条件下可获得无偏参数估计，但标准误会增加。

用途：

> Planned missing 不是“免费样本量”；设计必须把精度损失纳入 planning。

## Cognitive Interviewing

Willis 的 cognitive interviewing 路线以及 questionnaire response process 框架强调：

```text
comprehension
retrieval
judgment
response mapping
```

用途：

> P0 首先研究“用户究竟在回答什么”，而不是直接计算可靠性。

---

# 47. P1 启动前必须进一步冻结

```text
primary hypotheses
P1 exact item freeze
randomization algorithm
missingness coding
exclusion policy
anchor scale permissions
analysis software / estimators
simulation-based sample planning
P0-derived wording changes
```

---

# 48. 当前 Analysis Checkpoint

```text
P0 qualitative analysis           specified
P0.5 UX/data analysis             specified
P1 object-specific analysis       specified
Planned missing principles        specified
P2 retest/interview               specified
P3 revealed choice                specified
P4 dyadic validation              specified

NEXT:
simulation inputs after P0 item freeze
+
exact statistical model preregistration for P1
```
