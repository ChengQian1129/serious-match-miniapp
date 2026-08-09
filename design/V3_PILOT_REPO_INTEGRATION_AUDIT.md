# serious-match-miniapp
## V3 Pilot Repository Integration Audit v0.1

> 日期：2026-08-09
> 目的：明确现有 V2.1 代码哪些应保留、哪些不能继续作为 V3 runtime 假设，以及 V3 P0.5 的并行接入边界。

# 1. 当前仓库的正确资产

现有项目已经具备非常重要的工程基础：

```text
shared source-of-truth assessment schema
generated questionnaire definitions
instrument versioning
immutable answer event chain
local session persistence
cloud draft/recovery
report versioning
client/cloud boundary tests
questionnaire page regression tests
```

V3 不应该重写这些思想。

应该复用：

```text
版本化
不可变事件
session 恢复
source-of-truth → generated/runtime
回归测试
云函数作为数据边界
```

---

# 2. V2.1 与 V3 的真正冲突点

## V2.1

```text
ITEMS = fixed list
CHAPTERS = 6
each chapter = 8 items

current position:
chapterId + itemIndex

completion:
all ITEMS have answers

then:
buildReport()
```

## V3 Pilot

```text
Common Spine
+
randomized Form A/B/C
+
adaptive branch
+
compound parent/child task
+
planned missingness

completion:
all ASSIGNED tasks are accounted for

then:
completed_no_scoring
```

所以问题不在于：

> 旧代码写得差。

问题在于：

> 旧代码忠实实现了一个已经被 V3 放弃的测量模型。

---

# 3. 不修改 V2 的理由

如果直接把 V3 task 塞进：

```text
shared/assessment/schema.js
```

会同时冲击：

```text
scoring-engine
report-engine
chapter-insight-engine
session-store
questionnaire page
cloud assessment service
tests
historical report compatibility
```

这会把：

```text
科学模型迭代风险
```

和：

```text
已经可以工作的公开产品风险
```

绑在一起。

因此 P0.5 使用独立：

```text
relationship_manual_v3_pilot
```

是更稳的。

---

# 4. 当前 Drop-in 已实现

```text
shared/assessment-v3-pilot/runtime-bundle.js
shared/assessment-v3-pilot/runtime-engine.js

utils/assessment-v3-pilot/session-store.js

pages/questionnaire-v3-pilot/*
tests/assessment-v3-pilot-runtime.test.js
tests/assessment-v3-pilot-session.test.js
scripts/check-assessment-v3-pilot.js
```

---

# 5. 当前已通过的 Node 测试

```text
assessment-v3-pilot static/runtime checks OK
assessment-v3-pilot runtime OK
assessment-v3-pilot session smoke OK
```

验证了：

```text
Common Spine 不重复
Form pool 不和 Common 重叠
pool sample 不越界
3,000 个 assignment 无重复 parent
固定 seed deterministic
parenthood branch 可由真实回答驱动
child response schema 可验证
answer event supersedes chain
session resume assignment 不变化
```

---

# 6. 当前尚未实现的内容

## Cloud persistence

P0.5 第一版故意 local-only。

原因：

> 先验证 runtime contract，再改云数据结构。

## User report

故意没有。

## Scoring

故意没有。

## Generic hard-constraint branch

暂缓。

目前缺少一套覆盖所有 relevant L4/L5 task 的：

```text
potentialHardConstraint trigger metadata
```

不能让 runtime 自己猜。

## Worldview / Education / Height / Income deep branch

当前也保持 deferred。

需要先把：

```text
salience / hardness gate
```

变成 guaranteed runtime task + machine-readable trigger。

---

# 7. 下一轮仓库工作

推荐顺序：

```text
1. 把 drop-in 新文件复制到 repo

2. app.json 增加：
   pages/questionnaire-v3-pilot/index

3. package.json 增加：
   test:v3-pilot

4. 运行：
   npm run test:v3-pilot

5. 微信开发者工具直接打开 Pilot page

6. 验证：
   single select
   multi select
   number
   free text
   compound task

7. 验证：
   parenthood branch

8. 验证：
   exit / resume

9. 增加 telemetry timestamps

10. 再设计 v3 cloud contract
```

---

# 8. 在微信页面真正测试前要补的一件事

当前示范 renderer 已经能够根据：

```text
response.type
```

选择组件。

但多选按钮目前只展示 label，没有做完整视觉 selected-state。

P0.5 接入时应补：

```text
selected state
maxSelections feedback
validation error message
number unit / optional handling
compound task sub-progress
sensitive-content skip affordance
```

这属于 UI runtime，不改变研究 schema。

---

# 9. V3 Cloud Contract 后续建议

不要复用 V2 document 形状然后硬塞字段。

建议新 session payload：

```text
assessmentType
instrumentVersion
manifestVersion
taskLibraryVersion
assignment
answers
answerEvents
missingness
taskEvents
startedAt
updatedAt
completedAt
```

云函数仍然：

```text
OPENID from cloud context
client cannot write DB directly
```

这是现有项目值得继续保持的安全边界。

---

# 10. V2 历史数据

永久保留：

```text
relationship_manual_v2
```

不要迁成：

```text
relationship_manual_v3_pilot
```

除非未来单独建立：

```text
legacy_crosswalk
```

即使建立 crosswalk，也只能做：

```text
legacy mapping / research comparison
```

不能声称：

> V2 分数等价于 V3 construct estimate。

---

# 11. 当前工程判断

现在 V3 已经具备：

```text
完整架构
Mother Bank
Construct Registry
Item Registry
Pilot Forms
Runtime Task Library
Runtime Engine
Local Session
Generic Pilot Renderer
Node Tests
```

所以后面不应该再花大量时间继续写“更完整的架构”。

应该开始：

```text
真实 UI execution
→ P0.5 telemetry
→ P0 cognitive interview
```

这才会产生下一批真正有价值的信息。
