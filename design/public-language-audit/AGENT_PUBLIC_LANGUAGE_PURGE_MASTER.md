# Serious Match — 全量公开语言清理
## Agent Public Language Purge Master v1.0

> 日期：2026-08-09  
> 目标仓库：`ChengQian1129/serious-match-miniapp`  
> 任务性质：**P0 用户可见语言重构**  
> 本任务不修改科学模型、构念、评分逻辑、随机分组设计或后续线下业务模式。

---

# 0. 结论

当前产品 **NOT PUBLIC-COPY READY**。

问题已经不只是个别句子“AI 味重”，而是公开层仍混有四种不该出现的语言：

1. **人为造出来的产品概念**  
   例如“关系说明书”“关系决策地图”“关系快照”“关系画像”“关系倾向”。

2. **研究 / 测量 / 开发内部语言**  
   例如 Pilot、P0/P1、Level 1–5、constructId、planned missing、候选、soft filter、内部激活、代理信号等。

3. **逻辑正确但正常人不会这样说的话**  
   例如“有表达资源”“关系承载力”“自评资源仍需要在真实互动中验证”“压缩个人边界”。

4. **AI 常见的解释型修辞**  
   例如连续出现“这并不意味着……”“真正重要的是……”“还有一种可能……”“从你的回答来看……”。

本任务的目标不是“把文案润色得更高级”，而是：

> **所有用户能看到的文字，都必须像一个正常人真的会说、会读、会理解的话。**

---

# 1. 最重要的规则

## 1.1 用户端不需要理解我们的模型架构

内部可以继续使用：

```text
Relationship Feature Model V3
C1–C6
L3 / L4 / L5
Construct
Dimension
Scoring
Confidence
Branch
Planned Missing
```

用户端不要翻译成新的“高级中文名词”。

错误做法：

```text
关系说明书
关系决策地图
关系运行模型
伴侣决策画像
关系承载力
不确定性激活
支持信号表达
修复再投入
```

正确做法是直接说事情：

```text
你的结果
你现在想不想谈恋爱
你现在有没有时间和精力
对方态度变了，你通常会怎样
关系越来越亲近以后
你希望对方怎么支持你
吵架以后，你通常怎么处理
你希望两个人怎么相处
你找对象时比较在意什么
你对以后有什么打算
```

---

# 2. “凡是需要解释是什么意思的功能名，优先删除”

不要为了替换“关系说明书”又造一个新词。

例如不要改成：

```text
关系画像
亲密关系图谱
关系操作系统
个人关系档案
亲密关系坐标
```

这只是换了一种 AI / 咨询报告味。

公开页面只需要普通功能名：

```text
恋爱和相处
答题
这一部分完成
你的结果
你在意什么
为什么这么说
继续聊聊
后续联系
联系资料
隐私说明
```

---

# 3. 公开页面标题统一替换

必须同时修改：

- `app.json`
- `pages/**/index.json`
- 页面 WXML 中重复出现的 wordmark / kicker
- share title / empty state / delete dialog 等动态文案

建议公开标题：

| Surface | 用户可见标题 |
|---|---|
| 全局 / Welcome / Home | 恋爱和相处 |
| Questionnaire | 答题 |
| Chapter Insight | 这一部分完成 |
| Result | 你的结果 |
| relationship-map 路由 | 你在意什么 |
| record-claim | 为什么这么说 |
| Follow-up Intro | 继续聊聊 |
| Follow-up Settings | 后续联系 |
| Follow-up Profile | 联系资料 |
| Privacy | 隐私说明 |
| V3 Pilot | 答题 · 测试版 |

**禁止继续出现：**

```text
关系说明书
关系决策地图
当前关系状态
章节完成
结论依据
后续参与
参与者资料
授权与参与管理
```

其中“后续参与”不是违规词本身，而是当前页面标题过于运营 / 研究化；改为具体功能名。

---

# 4. Welcome / Home

具体替换见：

```text
PUBLIC_UI_COPY_REWRITE.yaml
```

核心要求：

### Welcome

只回答：

```text
这里大概会问什么
多久
开始
```

不要先给产品起概念名。

删除：

```text
关系说明书 kicker
“只是把这些关系里真的会发生的事，一件件问清楚。”
```

主按钮：

```text
开始答题
```

而不是为了“产品感”写：

```text
开始看看
开始探索
开启你的关系说明书
```

---

# 5. Questionnaire

## 5.1 “组”统一改成“部分”

当前：

```text
第 2 组 / 6
回看这一组
继续下一章
```

公开改成：

```text
第 2 部分 / 6
修改这一部分的回答
继续下一部分
```

最后一部分：

```text
查看全部结果
```

不要：

```text
查看完整说明书
```

## 5.2 题目本身也属于公开文案

V2 的 48 道题已经逐题审过。

需要改写的 V2 题目和量尺见：

```text
V2_PUBLIC_COPY_REWRITE.yaml
```

重要：

**改题文字如果构成实质性 wording change，必须按原有 measurement/versioning 规则升 item wording version。不能为了文案修改悄悄覆盖历史测量版本。**

---

# 6. 六个部分的开场全部改成人话

公开标题：

```text
1 你现在想不想谈恋爱
2 你现在有没有时间和精力
3 对方态度变了，你通常会怎样
4 关系越来越亲近以后
5 你希望对方怎么支持你
6 吵架以后，你通常怎么处理
```

开场正文和 hint 的完整替换见：

```text
PUBLIC_UI_COPY_REWRITE.yaml → chapters
```

删除 / 不再公开使用：

```text
lead
reflection
独立 impact block
“情绪空间”
“关系意愿”
“修复与重新靠近”
“回应的连续性”
```

这些概念可以留在内部对象。

---

# 7. 每一部分答完后的页面

最终结构只允许：

```text
第 X 部分完成

标题

一句核心结论

2–3 句解释

为什么这么说 >

[继续下一部分]
```

不要再出现：

```text
C1
这一组答完了
lead
impact
reflection
boundary paragraph
像你吗？
很像 / 有一点像 / 不太像 / 说不好
```

## 7.1 “像你吗？”必须整条删除

不仅删 UI。

新 session 不再主动采集：

```text
chapterFeedback
selectedFeedback
feedbackOptions
chapter_insight_feedback
```

旧数据保持兼容读取即可，不做破坏性迁移。

## 7.2 依据入口

统一：

```text
为什么这么说
```

展开：

```text
主要参考了这些回答

「题目」
你的回答：……
```

不要：

```text
结论依据
为什么会有这句话
主要是这几道回答放在了一起
支持证据 / 反证 / 限定证据
```

---

# 8. 当前 V2 动态章节结果必须重写

当前 `utils/assessment-v2/chapter-insight-engine.js` 内部仍直接拼接大量公开叙述。

这是 P0。

不要只改 WXML，因为用户最后看到的核心文字来自 engine。

公开层改为由审核过的内容源提供：

```text
V2_PUBLIC_COPY_REWRITE.yaml
→ chapterNarrativePublic
```

公开章节页只渲染：

```text
headline
summary
```

旧：

```text
signals
impact
reflection
boundary
```

不作为主页面用户文案。

内部计算结果可继续保留。

---

# 9. 当前 V2 报告动态文案必须收口到一个审核源

当前 `shared/assessment/report-engine.js` 内还有硬编码的公开文字，例如：

```text
多道回答一致支持这个方向。
当前回答较多指向这个方向。
这是当前自述形成的方向，不是固定人格。
有这项资源……
修复……
关系资源……
```

不允许 engine 自己维护另一套用户语言。

要求：

```text
计算 engine
↓
claim/state id
↓
reviewed public copy registry
↓
UI
```

而不是：

```text
计算 engine
↓
现场拼一段心理报告文字
```

当前 28 个 claim family 的审核版见：

```text
V2_PUBLIC_COPY_REWRITE.yaml → claimCopyOverrides
```

---

# 10. 最终结果页

公开标题：

```text
你的结果
```

不是：

```text
你的关系说明书
关系快照
```

推荐层级：

```text
你的结果

先看这 3 点
↓
各部分结果
↓
更多结果
↓
修改回答
↓
如果你愿意，可以再聊聊
↓
数据和隐私
```

具体文字见：

```text
PUBLIC_UI_COPY_REWRITE.yaml → result
```

### 删除抽象解释

例如不要：

```text
从开始、投入、靠近到冲突，看看你的关系倾向怎样连在一起。
```

直接删，不需要润色。

不要：

```text
有些回答暂时没有形成清楚方向。先保留问题，比勉强补出结论更有用。
```

改成：

```text
这些题的回答还不够一致，现在先不下结论。
```

---

# 11. “关系决策地图”这个用户概念取消

内部：

```text
relationship-map
L3/L4/L5
```

可以继续保留。

公开不要再教育用户什么叫“决策地图”。

当前路由的可见页面名：

```text
你在意什么
```

未来内容自然分成：

```text
你希望两个人怎么相处
你找对象时比较在意什么
你对以后有什么打算
```

不需要给三块内容再套一个总概念。

具体 copy 见：

```text
PUBLIC_UI_COPY_REWRITE.yaml → relationshipMap
```

---

# 12. 后续访谈必须保留

本任务**不删除后续访谈**。

小程序的后续漏斗仍然保留：

```text
完成答题
↓
看到结果
↓
自愿了解一对一访谈 / 补充研究 / 大连线下交流
↓
人与人的真实交流
```

不要增加软件内：

```text
我愿意进入匹配池
我愿意接受人工相亲匹配
manual_matchmaking
```

相亲匹配是之后真实交流中的业务，不需要在当前软件里提前写出来。

## 12.1 Follow-up 的问题是“研究腔”，不是入口本身

删除或改写：

```text
模型研究
问卷理解测试
可选参与
你愿意参与到哪一步？
参与登记
```

具体替换见：

```text
PUBLIC_UI_COPY_REWRITE.yaml → followup
```

用户应该能直接理解：

```text
一对一访谈
允许使用去掉身份信息后的回答改进这套题
大连线下活动
```

---

# 13. Privacy 页面也必须说人话

隐私页允许比普通页面正式，但不能出现开发备注和内部流程语言。

### P0 禁止

公开页面绝对不能出现：

```text
公开测试前需在微信公众平台配置
正式公开测试前，运营主体需要确认……
云环境 ID
数据库 collection
角色权限实现细节
被分配案例
验证记录
```

### 替换

例如：

```text
去标识化研究使用
```

改成：

```text
做研究分析时，我们会先去掉能直接识别你的信息。
```

```text
联系方式隔离保存
```

改成：

```text
联系方式会和问卷回答分开保存。
```

具体完整文字见：

```text
PUBLIC_UI_COPY_REWRITE.yaml → privacy
```

---

# 14. 错误提示也属于公开文案

用户绝不能看到原始技术错误。

禁止直接显示：

```text
请先配置微信云开发环境 ID
云数据库集合尚未建立
云开发环境配置不匹配
未知 itemId
instrumentVersion mismatch
assessmentType
server error.message
stack trace
```

要求：

```text
raw technical error
↓
log / telemetry
↓
public error mapper
↓
白名单用户提示
```

白名单见：

```text
PUBLIC_UI_COPY_REWRITE.yaml → errors
```

例如：

```text
暂时保存失败，请检查网络后再试。
暂时加载失败，请稍后再试。
这道题出了点问题，请返回后再试。
还有题没答完。
```

---

# 15. V3：不是只有页面壳需要改

V3 是这次全量审计里最大的潜在污染源。

已经审核：

```text
411 parent task prompts
119 child prompts
1,126 response option labels
```

加上 response-format 和 task-specific option override 后，逐字符串审计表共有：

```text
1,696 rows
```

完整结果：

```text
V3_ALL_USER_FACING_STRINGS_AUDIT.csv
```

每一行都有：

```text
surface_id
source
kind
current_text
decision
recommended_text
reason
```

决策只有：

```text
PASS
REWRITE
ADD
BLOCKER_REPLACE_TASK_SPECIFIC
```

Agent 必须按这个表执行，不能自行“统一润色”。

---

# 16. V3 P0 Blocker：Level 1–5

当前通用 format 仍有：

```text
Level 1
Level 2
Level 3
Level 4
Level 5
```

这绝对不能给用户看。

原因：

- 用户不知道 Level 表示什么；
- 不同 construct 的 1–5 含义并不一样；
- 它是作者内部占位，不是回答选项。

这 10 个 generic label 在审计 CSV 中标记为：

```text
BLOCKER_REPLACE_TASK_SPECIFIC
```

不能简单替换成：

```text
很低
较低
一般
较高
很高
```

因为不同题不是同一条连续轴。

必须使用已经给出的 **task-specific five labels**。

详见 CSV 中对应：

```text
ADD
```

记录。

---

# 17. V3 题库中已经发现并改写的典型 P0 语言

包括但不限于：

```text
Pilot
为了测试……
系统把他/她作为候选
不要作为候选
候选人
3 个升级点
内部激活
激活程度
认知交流
学习能力的代理信号
事业导向
家庭导向
soft filter
资源条件
默认规则
可协商
互惠
压缩个人边界
```

这些不是“风格偏好”。

**它们是公开语言错误。**

对应具体 item / option 已经全部落在：

```text
V3_ALL_USER_FACING_STRINGS_AUDIT.csv
```

---

# 18. V3 正式结果文案也已全量审计

未来 V3 报告 authoring library 不能直接把内部 authoring 文案暴露给用户。

已审核：

```text
14 dimensions
65 dimension-state narratives
16 cross-chapter patterns
```

公开 override：

```text
V3_PUBLIC_NARRATIVE_OVERRIDE.yaml
```

## 18.1 公开默认只允许两个字段

每个 state：

```text
headline
summary
```

默认不要显示：

```text
internal label
relationshipMeaning
possibleFriction
usefulConditions
caveat
measurementConfidence
evidence status
provisional
partner/dyadic evidence
```

除非以后某个字段被单独做人话审查并明确加入 public schema。

---

# 19. V3 报告公开标题

禁止：

```text
关系准备度
关系承载力
不确定中的激活
支持信号
回应能力线索
冲突激活
修复再投入
关系决策地图
```

公开：

```text
你的结果

先看这 3 点

你现在想不想谈恋爱
你现在有没有时间和精力
对方态度变了，你通常会怎样
关系越来越亲近以后
你希望对方怎么支持你
吵架以后，你通常怎么处理

你希望两个人怎么相处
你找对象时比较在意什么
你对以后有什么打算

还有几件事，问卷看不出来
如果之后聊一聊，可以重点聊这些
这些结果怎么来的
```

---

# 20. AI 腔不是靠关键词完全解决

下面这些不是绝对禁词，但出现一次就要求人工看一遍：

```text
这并不意味着……
真正重要的是……
值得注意的是……
从你的回答来看……
这说明……
这可能意味着……
在某种程度上……
还有一种可能……
更准确地说……
换句话说……
```

同一段连续出现两个以上，默认判失败。

另有高风险抽象词：

```text
自评
线索
机制
资源
承载
调节
适配
维度
构念
路径
策略
框架
默认规则
可协商
互惠
个人边界
```

不是机械禁止所有语境，但公开文案作者必须证明：

> 一个普通用户真的会这么说。

---

# 21. 三个强制“人话测试”

所有新增公开文案必须通过：

## Test A — 微信测试

问：

> “我会把这句话直接微信发给朋友吗？”

如果：

> 意思能懂，但现实里我不会这么说。

FAIL。

## Test B — 朗读测试

把句子真的念出来。

如果听起来像：

```text
论文
咨询报告
心理测评报告
产品经理方案
ChatGPT 总结
```

FAIL。

## Test C — 名词测试

如果一个名词需要再加一句：

> “这里的 XXX 是指……”

优先删掉这个名词，直接说它具体在问什么。

---

# 22. 以后必须建立 Public Copy Gate

仅做这次人工清理不够。

Agent 必须新增类似：

```text
scripts/check-public-language.js
```

并加入：

```text
npm test
```

至少检查：

### 22.1 固定公开 surface

```text
app.json
pages/**/*.json → navigationBarTitleText
pages/**/*.wxml → text node / aria-label / placeholder / modal label
shared/content/**/*
```

### 22.2 动态公开 surface

```text
shared/assessment/schema.js → item / scale / chapter public text
V2 claim copy registry
V2 chapter public narrative registry

research/v3 normative questionnaire public prompt/options
V3 generated runtime prompt/options

V3 public narrative override
```

### 22.3 Error surface

扫描：

```text
wx.showToast
wx.showModal
setData({ error })
user-facing error objects
```

确保只有 public error whitelist 能显示。

---

# 23. 不允许页面随手新增未经审查的中文字符串

长期目标：

```text
pages
↓
reference reviewed copy key
```

而不是：

```js
wx.showToast({
  title: '这里随手写一句新提示'
})
```

推荐 CI 做两层：

### Hard-block scan

来源：

```text
PUBLIC_FORBIDDEN_LANGUAGE.yaml
```

出现即失败。

### New-string review

生成 public string snapshot。

PR 中如果新增了公开字符串：

```text
CI FAIL / review required
```

直到它被加入 reviewed public copy source。

这样才能做到：

> 这次清干净以后，不会下一次 Agent 改功能又重新长回来。

---

# 24. 当前公开页面逐页验收

## Welcome

- [ ] 不出现“关系说明书”
- [ ] 没有概念 kicker
- [ ] 直接告诉用户会问什么
- [ ] “开始答题”清楚
- [ ] 方法说明是次级入口

## Home

- [ ] 不重复 Welcome 的营销话
- [ ] 首次 / 继续 / 已完成三种状态都说普通话
- [ ] 不出现“模型研究”
- [ ] 不出现“你的说明书已经在这里了”

## Questionnaire V2

- [ ] 第 X 部分 / 6
- [ ] 48 题逐题使用审核版 wording
- [ ] scale wording 使用审核版
- [ ] 不展示内部 construct / dimension
- [ ] 无内部错误

## Questionnaire V3

- [ ] 411 parent prompt 全部来自审核表
- [ ] 119 child prompt 全部来自审核表
- [ ] 所有 options 全部来自审核表
- [ ] Level 1–5 不可能渲染
- [ ] 不出现 Pilot / A/B/C / planned missing / 内部状态码
- [ ] 顶部不叫“关系探索”
- [ ] 不把 parent task 叫“任务”

## Chapter Insight

- [ ] 不出现 C1/C2 等编号
- [ ] 不出现“这一组答完了”
- [ ] 不出现 lead / reflection / impact 独立层
- [ ] 不出现“像你吗”
- [ ] headline + short summary
- [ ] “为什么这么说”默认折叠

## Result

- [ ] 标题“你的结果”
- [ ] 不出现“关系说明书 / 快照 / 倾向”
- [ ] Top 3 优先
- [ ] 无方法论自我解释堆叠
- [ ] unknown 用普通话
- [ ] 删除按钮叫“删除这次结果”

## Relationship Map Route

- [ ] 用户不看到“关系决策地图”
- [ ] 页面名“你在意什么”
- [ ] 内容最终分成相处 / 找对象在意什么 / 以后打算
- [ ] 不创造新总概念

## Claim / Evidence

- [ ] 不叫“结论依据”
- [ ] 返回“你的结果”
- [ ] “为什么这么说”
- [ ] “主要参考了这些回答”
- [ ] 不展示 supporting / contradictory / qualifying 等研究分类

## Follow-up

- [ ] 一对一访谈保留
- [ ] 线下交流保留
- [ ] 独立授权保留
- [ ] 不出现“模型研究”
- [ ] 不新增人工相亲匹配软件内 opt-in

## Privacy

- [ ] 无开发配置备注
- [ ] 无数据库 / 云环境内部语言
- [ ] “去掉能直接识别你的信息”而不是要求用户理解“去标识化”
- [ ] 联系方式单独保存，说清即可

## Errors

- [ ] 100% 通过 public error mapper
- [ ] raw error.message 永不直接展示
- [ ] 不展示 ID / version / cloud 配置

---

# 25. Agent 执行顺序

## Phase 1 — 建立测试

先加：

```text
PUBLIC_FORBIDDEN_LANGUAGE.yaml
check-public-language.js
```

让当前代码先明确 FAIL。

不要先改文案再写测试。

## Phase 2 — 清固定 UI

按：

```text
PUBLIC_UI_COPY_REWRITE.yaml
```

处理 app/page/title/button/privacy/follow-up/error。

## Phase 3 — 清 V2

按：

```text
V2_PUBLIC_COPY_REWRITE.yaml
```

处理：

```text
48 items
scale
chapter intro
chapter narrative
28 claim families
fallback
```

把公开 narrative 从 engine 中抽离。

## Phase 4 — 清 V3 Questionnaire

按：

```text
V3_ALL_USER_FACING_STRINGS_AUDIT.csv
```

逐行实施。

所有：

```text
REWRITE
ADD
BLOCKER_REPLACE_TASK_SPECIFIC
```

必须解决。

## Phase 5 — 清 V3 Report

按：

```text
V3_PUBLIC_NARRATIVE_OVERRIDE.yaml
```

建立 public projection。

默认只输出：

```text
headline
summary
```

## Phase 6 — Error Gate

所有用户错误走白名单。

## Phase 7 — 全仓验收

```bash
npm test
npm run test:v3-pilot
node scripts/check-public-language.js
```

然后人工完整走一遍微信开发者工具。

---

# 26. 明确禁止 Agent 自由发挥

Agent 不可以：

```text
“为了更自然，我重新写了一套品牌语言”
“我把关系说明书改成关系画像”
“我统一把文字改得更温暖”
“我增加了一些鼓励用户的句子”
“我给报告增加了更完整的解释”
```

这都会重新制造 AI 味。

Agent 的任务是：

> **实施已经审核的 wording，并建立防止未经审核文字再次进入公开层的工程约束。**

---

# 27. Definition of Done

完成后，一个用户从第一次打开到退出小程序，看到的每一个中文字符串都应该满足：

1. 不需要知道我们的研究架构。
2. 不需要知道我们的开发架构。
3. 不需要学习我们自创的产品名词。
4. 能一遍读懂。
5. 朗读出来不尴尬。
6. 不像论文。
7. 不像咨询报告。
8. 不像产品经理。
9. 不像 ChatGPT 在解释自己。
10. 需要更正式的隐私/方法说明时，也仍然说普通中文。

最终体验应该是：

> “我答了一些关于恋爱和相处的问题，做完以后它告诉了我几个比较明显的结果。我想知道为什么，也能点开看自己之前怎么答的。如果愿意，我之后还可以和真人继续聊。”

而不是：

> “我完成了 Relationship Feature Model，并获得关系说明书、关系决策地图和多维关系画像。”
