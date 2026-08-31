# 关系说明书微信小程序（3.0.0 Product v0）

这是一个可直接导入微信开发者工具的原生小程序。当前公开运行时是 V3 Product v0，正式入口为 `/pages/home/index`：用户从自己的关系想法开始，按 10 个连续部分完成关系说明书，查看分层结果、章节总结和回答依据，并可以修改或删除本次结果。

公开端不提供 matching、候选浏览、双人比较、对象推荐、匹配分数、联系方式交换或聊天。Product v0 是理论驱动的试用版本，不是心理诊断、兼容性判断或专业机构标准测试。

V2 页面和云函数只作为旧版兼容与回归材料保留，不是当前公开主路径；V3 Pilot、P0 研究页和 Product preview 默认不进入 `app.json` 的公开包。

## 运行

1. 打开微信开发者工具并导入本仓库目录。
2. 使用项目当前配置的 AppID 运行。
3. 首次运行执行 `npm ci`（本地开发也可使用 `npm install`）。
4. 在微信开发者工具中执行“工具 -> 构建 npm”。
5. 运行 `npm test` 完成本地回归；发布前再运行 `npm run sync:release` 确认生成文件和包体积门禁。

## 云开发配置

1. 在微信开发者工具中开通云开发并创建环境。
2. 复制 config/cloud.example.js 为 config/cloud.js，填写云环境 ID 和运营主体名称。该文件已被 Git 忽略。
3. 建立 assessment_sessions、assessment_reports、assessment_feedback_events、consent_events、participant_registry、participant_contacts、interview_cases、interview_validation_events、operator_accounts 和 audit_events 集合。
4. 集合权限设为客户端不可读、不可写，所有操作通过云函数完成。
5. 运行 `npm run deploy:cloud`，或在微信开发者工具中上传并部署 `assessmentService`、`participantService`、`interviewOps` 和兼容入口 `datingProfile`。脚本会先同步全部 release artifacts，再从本地 `config/cloud.js` 读取环境 ID；不会把环境标识写入仓库。如果 CLI 不在默认路径，设置 `WECHAT_DEVTOOLS_CLI`。
6. 完成一份 Product v0 测试问卷，确认云端生成当前用户的 session 和 report；再从另一台设备验证恢复、修改和删除。真实设备、弱网和微信后台验收不能由本地脚本代替。

dating_profiles 仅作为旧版测试数据保留，不再接受新资料写入。

## 当前 Product v0 能力

- 10-part 用户旅程：核心关系线索、实际情况和生活安排按顺序展开
- 本地优先保存、云端同步、恢复、冲突选择和删除
- 不可变回答事件以及可追溯的跳过记录
- 部分结果、答案复核、已回答任务编辑和 Evidence → Edit → Evidence 闭环
- 完整结果、版本化报告、可追溯报告依据和修改后的重新计算
- 断网缓冲、旧设备写入保护以及删除后的本机/云端清理
- 后续访谈与研究的独立用途说明入口
- 后续参与资料、分用途授权、撤回与删除
- 参与者元数据和联系方式分集合保存
- 研究导出仅包含仍有效研究授权的去标识化记录
- 联系方式默认掩码；仅被分配访谈人员或管理员可在有效联系授权期间单独查看，并留下审计记录
- 确定性访谈假设、相对盲法阶段和模型辅助核对准备卡
- 自动化产品边界检查

## 维护者入口

- 当前产品与科学边界：`research/v3/product-v0/PRODUCT_V0_POLICY.md`、`design/QUESTIONNAIRE_SPEC.md`
- 问卷 canonical source：`research/v3/product-v0/product_questionnaire_v0.yaml`；运行时生成到 `shared/assessment-v3-product-v0/`
- 公共文案 source：`design/public-language-audit/`；`shared/content/public-language.generated.js` 是生成文件
- 发布状态和人工清单：`design/RC_HARDENING_STATUS.md`、`design/FULL_JOURNEY_MANUAL_TEST.md`、`design/RELEASE_CHECKLIST.md`
- v2.1 逐项验收证据：design/V2_1_COMPLETION_AUDIT.md
- Product v0 问卷、计分和运行时：`research/v3/product-v0/`、`shared/assessment-v3-product-v0/`
- 云端数据契约：cloudfunctions/datingProfile/index.js
- 页面、导航、云端契约与发布门禁：`npm test`

## 当前明确不做

- 访谈运营接口已在云函数中实现角色校验、案例快照、准备卡和逐条验证事件；公开小程序不包含运营工作台页面
- 不做 matching、candidate browsing、recommendation 或 chat
- 不发送短信或微信通知
- 不使用微信手机号授权接口
- Product v0 的结果仅描述当前回答线索，不做诊断、配对、推荐或未来预测；研究状态仍为 `THEORY_DRIVEN_PROVISIONAL`
- 正式对外发布前仍需运营主体在微信后台核对隐私政策、保存期限、用户权利、云环境集合权限，并完成真机和弱网验收

产品公开文案遵循 `design/VOICE_AND_TONE.md`；内容体验 Sprint 2 的改造与边界见 `design/CONTENT_EXPERIENCE_SPRINT_2_AUDIT.md`。

## V3 研究 Pilot（默认关闭）

V3 Pilot 和 P0 研究页面仍保留在仓库中供内部回归，但已从正式小程序包排除。Product v0 的公开入口和研究 Pilot 使用独立运行时，正式包不会把研究题库依赖带入用户链路。

临时在微信开发者工具中测试时，将 `utils/features.js` 中的 `FEATURES.v3Pilot` 改为 `true`，然后直接打开 `/pages/questionnaire-v3-pilot/index`。测试完成后恢复为 `false`，生产默认不会展示该入口。

题库源文件只能通过以下命令生成 runtime bundle，不能手改生成文件：

```text
npm run sync:assessment-v3-pilot
npm run test:v3-pilot
```

当前自动分支为 `PARENTHOOD_TIMING`、`PARENTHOOD_OPEN_OR_WANTS`、`PARENTHOOD_UNSURE`；硬约束、世界观、教育、身高和收入分支仍是 deferred，等统一的 machine-readable trigger 进入规范后再启用。

云函数从微信上下文取得 OPENID，不信任客户端传入的用户标识。数据库集合不得开放为客户端直接读写。

## Release 流程

```text
npm ci
npm run sync:release
npm test
npm run deploy:cloud
```

`npm run sync:release` 会重新生成公共文案、Product v0 题库与计分包、旧版兼容包以及四个云函数包；生成文件不得手改。`npm test` 会检查主包估算、公共文案、路由、数据契约、断网同步和 Product v0 云端生命周期。CI 使用 `.github/workflows/release-checks.yml`，项目 Node 固定为 20。

当前仓库目标是 code-level Release Candidate，不等于已经完成 iOS/Android 真机、弱网、跨设备、云权限和微信隐私后台验收；这些状态以 `design/RC_HARDENING_STATUS.md` 为准。

使用 Codex Computer Use 检查微信开发者工具时，如遇到 NW.js 窗口归属错误，请查看 TROUBLESHOOTING.md。
