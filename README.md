# 关系说明书微信小程序

这是一个可直接导入微信开发者工具的原生小程序。公开端只提供个人关系评估、可核对的关系说明书、结论依据与本人修正；用户可以另行了解并自愿参加后续访谈、模型研究或线下活动。

公开端不提供候选浏览、双人比较、对象推荐、联系方式交换或聊天。

## 运行

1. 打开微信开发者工具并导入本仓库目录。
2. 使用项目当前配置的 AppID 运行。
3. 首次运行执行 npm install。
4. 在微信开发者工具中执行“工具 -> 构建 npm”。
5. 运行 npm test 完成本地回归。

## 云开发配置

1. 在微信开发者工具中开通云开发并创建环境。
2. 复制 config/cloud.example.js 为 config/cloud.js，填写云环境 ID 和运营主体名称。该文件已被 Git 忽略。
3. 建立 assessment_sessions、assessment_reports、assessment_feedback_events、consent_events、participant_registry、participant_contacts、interview_cases、interview_validation_events、operator_accounts 和 audit_events 集合。
4. 集合权限设为客户端不可读、不可写，所有操作通过云函数完成。
5. 上传并部署 cloudfunctions/datingProfile。
6. 完成一份测试问卷，确认云端生成当前用户的 session 和 report。

dating_profiles 仅作为旧版测试数据保留，不再接受新资料写入。

## 已实现

- 48 道、6 章关系探索题
- 不可变回答事件以及 NA、SKIP
- 版本化计分和可追溯报告依据
- 每章阶段发现与本人核对
- 完整关系说明书、关系底图和历史报告
- 本机保存与可选云端保存
- 跨设备恢复问卷和报告
- 本人确认后的分享名片
- 云端问卷、报告和本机副本删除
- 后续访谈与研究的独立用途说明入口
- 后续参与资料、分用途授权、撤回与删除
- 参与者元数据和联系方式分集合保存
- 自动化产品边界检查

## Review 入口

- 产品与科学边界：design/QUESTIONNAIRE_SPEC.md
- 问卷定义与计分：utils/assessment-v2/
- 云端数据契约：cloudfunctions/datingProfile/index.js
- 页面与导航回归：npm test

## 当前边界

- 私有访谈工作台仍在 v2.1 开发计划中
- 不发送短信或微信通知
- 不使用微信手机号授权接口
- 公开测试前仍需补齐运营主体联系方式、保存期限和用户权利等正式隐私政策

云函数从微信上下文取得 OPENID，不信任客户端传入的用户标识。数据库集合不得开放为客户端直接读写。

使用 Codex Computer Use 检查微信开发者工具时，如遇到 NW.js 窗口归属错误，请查看 TROUBLESHOOTING.md。
