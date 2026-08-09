# Relationship Feature Model V3
## serious-match-miniapp 并行集成方案 v0.1

> 目标：不破坏当前 v2.1 公开版，在仓库中并行加入一个 **local-only / no-scoring** 的 V3 P0.5 技术 Pilot。

# 1. 为什么不是直接升级 assessment-v2

当前仓库已经把 v2.1 的 48 题、报告、chapter insight、云端同步、历史报告和大量测试绑定在一起。

V3 的核心运行假设已经不同：

```text
V2:
6 chapters × 8 items
single-choice numeric/NA/SKIP
all ITEMS complete
→ scoring
→ report

V3 Pilot:
Common Spine
+ randomized Form A/B/C
+ conditional branches
+ compound parent/child responses
+ planned missingness
+ no production scoring
```

因此最安全的演进是：

```text
assessment-v2
KEEP

assessment-v3-pilot
ADD IN PARALLEL
```

# 2. 建议目录

```text
shared/
  assessment-v3-pilot/
    runtime-bundle.js
    runtime-engine.js

utils/
  assessment-v3-pilot/
    session-store.js

pages/
  questionnaire-v3-pilot/
    index.js
    index.wxml
    index.wxss
    index.json

tests/
  assessment-v3-pilot-runtime.test.js

scripts/
  check-assessment-v3-pilot.js
```

# 3. Source of Truth

长期不应该手改 `runtime-bundle.js`。

当前 drop-in 为了能独立运行，把版本化 registry 编译成了一个 CommonJS bundle。

下一阶段仓库内应增加：

```text
research/v3/
  registry/
  pilot/
```

和类似现有：

```text
scripts/sync-assessment-schema.js
```

的编译脚本：

```text
scripts/sync-assessment-v3-pilot.js
```

正式链路：

```text
research source artifacts
↓
sync script
↓
shared/assessment-v3-pilot/runtime-bundle.js
↓
client/cloud/tests
```

这与当前 v2.1 的 generated-definition 模式一致。

# 4. V2 可复用的东西

保留并借鉴：

```text
immutable answer event idea
instrument versioning
local storage
cloud draft/recovery architecture
client cannot directly write DB
OPENID from cloud context
audit event idea
tests
```

不要直接复用：

```text
CHAPTERS
fixed itemOrder = ITEMS.map(...)
currentChapterId/currentItemIndex
all ITEMS answered
buildReport() on completion
numeric options only
```

# 5. P0.5 本地 session

新 key：

```text
serious_match_assessment_v3_pilot
```

V2 key 不动。

这样同一微信开发者工具里：

> V2 正常使用，V3 Pilot 单独测试，互不污染。

# 6. V3 assignment

第一次创建 session 时保存：

```text
seed
formKey
commonTaskIds
formTaskIds
branchTaskIds
assignedParentTaskIds
manifestVersion
```

恢复时必须读取已有 assignment。

不能：

```text
onLoad()
→ 再次 Math.random()
```

# 7. Parenthood Branch

当前已经可执行：

```text
L5-CH01 desire
L5-CH02 intention
```

驱动：

```text
timing
quantity
uncertainty reason
parenting operation
```

# 8. 暂不自动执行的 Branch

当前明确 DEFERRED：

```text
generic hard-constraint confirmation
worldview deep
education hardness
height hardness
income hardness
```

原因不是“不做”。

而是当前 P1 题流里：

> 还没有为这些分支统一定义一个必然出现、machine-readable 的 trigger item。

应该补 trigger metadata 后再启用，不能靠程序猜。

# 9. Questionnaire Page

现有 v2 questionnaire 页面写死：

```text
questionCount: 8
index < 7
chapter.itemIds[index]
numeric option vs special option
```

V3 页面不应该继续 patch 这些 if。

新页面按 runtime task 渲染：

```text
single_select
multi_select
number
free_text
compound
```

# 10. Compound Task

例如一个 uncertainty scenario：

```text
UA-S01
```

页面壳不直接存“UA-S01 = 3”。

而是：

```text
UA-S01.a concern
UA-S01.b attentionalCapture
UA-S01.c initialInterpretation
```

# 11. Completion

P0.5：

```text
complete
→ completed_no_scoring
```

不调用：

```text
scoring-engine
report-engine
chapter-insight-engine
```

技术 Pilot 成功页只提示测试完成。

# 12. 云端

第一步不要立刻改 `assessmentService`。

先把本地 runtime 跑稳。

第二步新增：

```text
assessmentServiceV3Pilot
```

或给现有 service 加明确：

```text
assessmentType/version dispatcher
```

但不应该让 v3 payload 伪装成 v2 session。

# 13. 数据迁移

不迁移：

```text
relationship_manual_v2 answers
→ V3 scores
```

V2 历史记录继续按 V2 解释。

未来若研究需要，可以做：

```text
legacy crosswalk
```

但只能作为 mapping / comparison，不能声称等价测量。

# 14. 接入步骤

```text
1. 复制本 drop-in 目录中的新增文件到仓库
2. app.json 加 pilot page
3. package.json 加 test:v3-pilot
4. npm run test:v3-pilot
5. 微信开发者工具直接访问 /pages/questionnaire-v3-pilot/index
6. 跑 baseline / parenthood branch
7. 检查 local storage
8. 检查退出恢复 assignment 不变
9. P0.5 telemetry 稳定后再接云
```

# 15. 当前不要做

```text
不要删 v2.1
不要把 V3 task 塞进 V2 CHAPTERS
不要先做 report
不要先写 match score
不要把 planned missing 当漏答
不要让 page 决定研究随机逻辑
```
