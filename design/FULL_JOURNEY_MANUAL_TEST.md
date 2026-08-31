# Product v0 full journey manual test

这份清单由真人在微信开发者工具、iOS 真机或 Android 真机执行。自动化测试不能替代完整点击、键盘、滚动、后台恢复和真实网络验收。

## Test record

- status: `NOT VERIFIED`
- start time:
- end time:
- device / OS:
- WeChat version:
- app version:
- commit SHA:
- network condition:
- tester:

## Fresh session

- [ ] 删除上一份本机和云端测试数据，重新打开小程序
- [ ] Welcome / Home 只出现一次，恢复中的主 CTA 不可点击
- [ ] 点击开始后进入第 1 个部分，不新建第二份 session
- [ ] 观察回答后立即切后台，再重新打开；已确认的回答仍在

## Ten-part journey

- [ ] Section 1：进入一段关系，完成后 checkpoint 文案和进度正确
- [ ] Section 2：时间与投入，上一题/继续可用
- [ ] Section 3：面对不确定，长题干正常换行
- [ ] Section 4：亲密与个人空间，多选题选择状态和最少选择校验正确
- [ ] Section 5：支持与被理解，数字/文本题键盘和失焦保存正确
- [ ] Section 6：冲突与修复，完成后明确提示核心部分已完成但整份还未完成
- [ ] Section 7：基本情况，进入顺序没有跳题
- [ ] Section 8：日常相处怎么安排，返回后进度不倒退
- [ ] Section 9：伴侣在意什么，暂停后可从原位置继续
- [ ] Section 10：以后想过怎样的生活，最后一题完成后生成完整结果

## Partial result and editing

- [ ] 在 Section 1 完成后打开目前结果
- [ ] 主按钮是“继续完成”，次要路径是查看回答
- [ ] 部分结果不显示完整总结、跨部分模式、整体决策地图或完成措辞
- [ ] Answer Review 中已回答任务显示“修改回答”
- [ ] 未回答的未来任务没有修改入口，点击 section 也不能绕过顺序
- [ ] 修改已回答任务后显示“已更新”，回到原来的部分结果上下文
- [ ] 回到继续填写时仍在原来的 current task，不跳回第 1 题

## Final result and evidence

- [ ] 完成最后一个 required task 后才显示完整结果
- [ ] 结果主按钮是“修改回答”，不是“回到答题”
- [ ] 结果 → 依据 → 修改来源回答 → 保存 → 回到原依据页
- [ ] 结果 → 回答复核 → 修改 → 保存 → 回到回答复核
- [ ] 修改后旧结果仍可在云端历史中识别，新结果有更高 report revision
- [ ] 结果反馈点击立即有状态，云端失败不会阻塞阅读，重试不会无限重复提交

## Pause, restore and network

- [ ] 每个部分完成后暂停回首页，再继续时 current task 正确
- [ ] 断网回答后显示“已保存在本机，联网后同步”，不显示数据丢失
- [ ] 恢复网络后同步失败可重试，期间本机回答不被覆盖
- [ ] 双设备产生新旧进度时显示选择，不自动猜测覆盖
- [ ] 删除确认后本机结果消失，真实云环境再核对 session/report/feedback 清理

## Record observations

- total duration:
- section 1 duration:
- section 2 duration:
- section 3 duration:
- section 4 duration:
- section 5 duration:
- section 6 duration:
- section 7 duration:
- section 8 duration:
- section 9 duration:
- section 10 duration:
- confusing questions:
- most tiring part:
- first moment the result felt useful:
- result that felt least like the tester:
- UI friction / keyboard / safe-bottom issues:
- bugs and screenshots:

## Simulator matrix

| Window | Safe bottom | Long question | Multi-select | Validation | Result expand | Review | Evidence | Modal | Restore loading | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 320 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | `NOT VERIFIED` |
| 375 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | `NOT VERIFIED` |
| 390/393 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | `NOT VERIFIED` |
| 430 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | `NOT VERIFIED` |

真机与微信隐私后台状态必须按 `design/RC_HARDENING_STATUS.md` 填写 `VERIFIED`、`NOT VERIFIED` 或 `BLOCKED`，不能用模拟器结果代替。
