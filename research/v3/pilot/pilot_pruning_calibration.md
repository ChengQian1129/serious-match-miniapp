# Relationship Feature Model V3
## Pilot Pruning & Scoring Calibration Specification v1.0
### 拿到真实数据以后，怎样删题、合并、定权重、定结论区间

> 日期：2026-08-09
> 状态：**Pre-Pilot Decision Framework**
> 核心目的：防止 Pilot 之后又回到“看哪个结果顺眼就留下、alpha 高就留下、为了缩短问卷平均每维度删成 3 题”的随意决策。

---

# 1. Pilot 的任务不是证明我们现在设计得对

真正的问题是：

```text
哪些构念真的能被用户理解？
哪些题在测我们以为的东西？
哪些题只是社会正确答案？
哪些维度其实重复？
哪些结论真的能帮助用户和人工运营？
哪些静态信息对真实选择有用？
哪些东西只能等真人互动以后知道？
```

如果 Pilot 最后删除我们很喜欢的一部分题或构念：

> 这说明 Pilot 在发挥作用。

---

# 2. 绝不使用“一个标准删所有题”

V3 有六种测量 grammar。

所以：

```text
psychometric item
scenario
need profile
operating standard
preference function
constraint / life plan
```

不能共用：

> `item-total correlation < x → 删除`

这种机械规则。

---

# 3. Psychometric 类怎么删

主要涉及：

```text
relationship_readiness
initiation_motivation
uncertainty_activation
intimacy_dependence_comfort
conflict_activation
```

依次检查：

```text
用户是否理解
↓
ordinal response distribution
↓
factor / facet structure
↓
cross-loading / contamination
↓
local dependence / wording duplicate
↓
retest
↓
convergent / discriminant
↓
incremental value
```

**统计指标只是 review flag，不是自动删除开关。**

例如：

> 某题 loading 没有另一题高，但它覆盖了一个不可替代的 facet，那么不能仅因 loading 稍低就删掉。

反过来：

> 十道几乎同义的题可能带来非常漂亮的 alpha，但这不是好量表。

---

# 4. Scenario / Capability 类怎么删

最危险的不是 reliability，而是：

```text
“答案太明显”
```

如果所有人都知道：

> “应该先理解伴侣，再根据对方需要回应。”

那么这道题可能测到的是：

```text
我知不知道社会标准
```

而不是：

```text
我现实里能不能做到
```

因此重点看：

```text
response spread
social desirability
history match
interview examples
later partner report
real dyadic events
```

---

# 5. Need 类怎么删

例如：

```text
personal space
support need
conflict pacing
```

重点不是题之间是否高度相关。

真正要保住的是：

```text
用户的中心位置
+
范围
+
情境变化
```

如果一个 Need 在不同情境真的不同：

> 这不是 reliability failure，而是这个 Need 本身就是 contextual。

---

# 6. L3 Operating Standards 怎么删

看：

```text
用户是否真正形成 position
position confidence
是否有协商价值
是否影响 pair discussion
是否与其他 domain 重复
```

如果 70% 用户第一次看到：

> “共同账户到底怎么管？”

都回答：

```text
我从来没想过
```

不一定说明问题无价值。

可能说明：

> 这道题更适合以后关系进入某阶段再问。

这时应该：

```text
MOVE TO LATER STAGE
```

而不是逼用户现在编一个答案。

---

# 7. L4 Preference 怎么删

真正要检验：

```text
ideal
vs
acceptable
vs
trade-off
vs
revealed choice
```

例如：

```text
“我非常在意学历”
```

但 constrained choice 里总愿意牺牲学历；

真实候选选择里也几乎不受学历影响。

那么：

> 它可能是一个 stated ideal，却不是高权重 decision variable。

这时我们不应该简单说用户“说谎”。

应该保留：

```text
stated preference
!=
revealed priority
```

这个差异本身就是信息。

---

# 8. Hard Constraint 怎么校准

只有用户显式确认：

> “即使其他方面都很好，这一点不满足我也不希望作为候选。”

才能：

```text
PREFERENCE
→ HARD CONSTRAINT
```

任何：

```text
重要度 5/5
```

都不能自动升级为 Hard。

真实运营继续尊重用户当前 hard constraint。

研究层另行跟踪：

```text
stated hard
→ real choice
```

---

# 9. Construct 不是只会 KEEP / DROP

正式决策有：

```text
KEEP_CORE
KEEP_SHORTEN
MERGE
DEMOTE_RESEARCH_ONLY
DEMOTE_INTERVIEW_ONLY
DROP
```

例如：

### `uncertainty_activation`

如果发现：

```text
与 attachment anxiety 高度重合
+
对 early-dating ambiguity 没有任何增量
```

那么应该：

```text
MERGE
or
DROP V3-specific construct
```

而不是因为我们已经写了很多文档，就硬保留。

---

# 10. 最终 Short Form 不是平均分题

错误目标：

```text
14 个维度 × 3 题
= 42 题
```

正确目标：

```text
每个维度需要多少信息
→ 就保留多少
```

可能最后：

```text
Readiness          5 items
Motivation         8 items
Capacity           6 inventory interactions
Support Need       3 scenarios
Responsiveness     4 scenarios
Conflict Pacing    3 tasks
...
```

不需要对称。

---

# 11. 结论区间怎么定

现在写的：

```text
VERY LOW
LOW
MID
HIGH
VERY HIGH
```

是：

> **Authoring zones**

不是 raw-score threshold。

Pilot 后：

```text
ordinal items
↓
measurement model
↓
person estimate + uncertainty
↓
zone calibration
```

如果数据只能支持：

```text
LOW / MID / HIGH
```

就用三档。

如果连三档都没有清晰边界：

> 直接用连续叙述，不为了 UI 硬切。

---

# 12. Profile 类怎么定

例如 Motivation。

不是：

```text
哪个 facet 最高
→ 强行给类型
```

而是只有当：

```text
facet difference
>
calibrated uncertainty margin
```

才说：

```text
DOMINANT
```

否则：

```text
MIXED
```

同样适用于 uncertainty regulation。

---

# 13. Capability 的置信度必须独立更新

例如 Responsiveness：

```text
第一次：
scenario
→ position = relatively high
→ confidence = PROVISIONAL
```

后来：

```text
partner report
+
真实 support events
```

可能得到：

```text
position ≈ high
confidence = HIGH
```

也可能：

```text
position ↓
confidence ↑
```

因此：

```text
position
!=
measurement confidence
```

---

# 14. Short Form 形成流程

```text
Mother Bank 411
↓
P0 认知访谈
↓
P1 candidate freeze
↓
构念/题目分析
↓
保住不可替代的 facet anchors
↓
删除重复/污染/低信息题
↓
建立 scoring model
↓
用 Full vs Short 模拟
↓
检查结论一致性和不确定性
↓
REPORT_CORE v2
```

必须检查：

> Short Form 是否还能得出和完整版相近的维度位置与章节结论。

如果删到非常短以后结论开始漂：

> 就说明删过头了。

---

# 15. 最终需要交付的 Calibration 产物

Pilot 后至少生成：

```text
Item Registry vNext
Construct Registry vNext
Scoring Model v0.1
Authoring Zone Calibration v0.1
REPORT_CORE v2
P1 Findings Memo
P2 Retest Plan
```

从此：

> 报告文案、评分模型和原始题目是不同版本对象。

不能再把它们写死在一个前端 JS 文件里。
