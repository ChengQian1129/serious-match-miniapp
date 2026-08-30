# 关系说明书微信小程序（3.0.0 Product v0）

这是一个可直接导入微信开发者工具的原生小程序。当前公开端默认进入 Product v0：用户独立完成一组关于关系想法、需要和相处方式的自我评估，查看基于本人回答生成的分层结果、章节总结和回答依据，并可以修改或删除本次结果。

公开端不提供候选浏览、双人比较、对象推荐、匹配分数、联系方式交换或聊天。Product v0 是理论驱动的试用版本，不是心理诊断、兼容性判断或专业机构标准测试。

## 运行

1. 打开微信开发者工具并导入本仓库目录。
2. 使用项目当前配置的 AppID 运行。
3. 首次运行执行 npm install。
4. 在微信开发者工具中执行“工具 -> 构建 npm”。
5. 运行 `npm test` 完成本地回归；发布前再运行 `npm run sync:release` 确认生成文件和包体积门禁。

## 云开发配置

1. 在微信开发者工具中开通云开发并创建环境。
2. 复制 config/cloud.example.js 为 config/cloud.js，填写云环境 ID 和运营主体名称。该文件已被 Git 忽略。
3. 建立 assessment_sessions、assessment_reports、assessment_feedback_events、consent_events、participant_registry、participant_contacts、interview_cases、interview_validation_events、operator_accounts 和 audit_events 集合。
4. 集合权限设为客户端不可读、不可写，所有操作通过云函数完成。
5. 运行 `npm run deploy:cloud`，或在微信开发者工具中上传并部署 `assessmentService`、`participantService`、`interviewOps` 和兼容入口 `datingProfile`。脚本会先同步全部 release artifacts，再从本地 `config/cloud.js` 读取环境 ID；不会把环境标识写入仓库。如果 CLI 不在默认路径，设置 `WECHAT_DEVTOOLS_CLI`。
6. 完成一份 Product v0 测试问卷，确认云端生成当前用户的 session 和 report；再从另一台设备验证恢复、修改和删除。

dating_profiles 仅作为旧版测试数据保留，不再接受新资料写入。

## 已实现

- 266 组、307 个回答字段、6 章 Product v0 自我评估
- 不可变回答事件以及可追溯的跳过记录
- 版本化计分和可追溯报告依据
- 每组完成后的章节结论、完整报告和回答依据
- 本地断网缓冲、云端同步、跨设备恢复、旧设备写入保护
- 回答修改后重新生成报告
- 云端问卷、报告和本机副本删除
- 后续访谈与研究的独立用途说明入口
- 后续参与资料、分用途授权、撤回与删除
- 参与者元数据和联系方式分集合保存
- 研究导出仅包含仍有效研究授权的去标识化记录
- 联系方式默认掩码；仅被分配访谈人员或管理员可在有效联系授权期间单独查看，并留下审计记录
- 确定性访谈假设、相对盲法阶段和模型辅助核对准备卡
- 自动化产品边界检查

## Review 入口

- Product v0 产品与科学边界：design/QUESTIONNAIRE_SPEC.md、research/v3/product-v0/PRODUCT_V0_POLICY.md
- 正式发布清单：design/RELEASE_CHECKLIST.md
- v2.1 逐项验收证据：design/V2_1_COMPLETION_AUDIT.md
- Product v0 问卷、计分和运行时：research/v3/product-v0/、shared/assessment-v3-product-v0/
- 云端数据契约：cloudfunctions/datingProfile/index.js
- 页面、导航、云端契约与发布门禁：`npm test`

## 当前边界

- 访谈运营接口已在云函数中实现角色校验、案例快照、准备卡和逐条验证事件；公开小程序不包含运营工作台页面
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
npm install
npm run sync:release
npm test
npm run deploy:cloud
```

`npm run sync:release` 会重新生成审核文案、Product v0 题库与计分包、旧版兼容包以及四个云函数包。`npm test` 会检查主包估算、公共文案、路由、数据契约、断网同步和 Product v0 云端生命周期。

使用 Codex Computer Use 检查微信开发者工具时，如遇到 NW.js 窗口归属错误，请查看 TROUBLESHOOTING.md。
