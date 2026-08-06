# 开发排障记录

## Codex Computer Use 无法绑定微信开发者工具窗口

### 已确认环境

- 微信开发者工具：Stable `2.01.2510290`
- Codex Computer Use：`26.727.51351`
- 微信开发者工具路径：`F:\Tencent\WeChatDevTools\wechatdevtools.exe`
- 记录日期：`2026-08-05`

### 症状

`list_apps()` 或 `list_windows()` 可以找到微信开发者工具，但把返回的窗口直接交给 `get_window()`、`get_window_state()` 或 `activate_window()` 时会报错：

```text
window id <id> no longer belongs to
nwjs._nwjs_mbeehgnikfbgjh.eb2ec0c5982e.Default;
current owner is
nwjs._nwjs_mbeehgnikfbgjh.eb2ec0c5982e.Default
```

报错中的旧归属和当前归属看起来完全相同。

### 根因

微信开发者工具基于 NW.js，在 Windows 中同时暴露两种应用身份：

```text
nwjs._nwjs_mbeehgnikfbgjh.eb2ec0c5982e.Default
process:F:\Tencent\WeChatDevTools\wechatdevtools.exe
```

Computer Use 的窗口枚举返回 NW.js AppUserModelID，但后续窗口所有权校验对该窗口实际接受进程身份。内部比较的是不同类型的身份对象，错误信息只打印了显示字符串，所以会出现“同一个身份不等于自己”的误导性提示。

微信开发者工具还可能在运行中重建顶层窗口，导致窗口 ID 改变。因此不能保存旧 ID 长期复用。

### 已验证的对照结果

- 最新窗口 ID + NW.js AppUserModelID：失败。
- NW.js AppUserModelID 改大小写：失败。
- 最新窗口 ID + `process:` 进程身份：成功。
- Chrome 窗口使用其正常应用身份：成功。
- 使用进程身份后，微信开发者工具可以激活并成功截取模拟器画面。

这说明问题位于 Computer Use 对 NW.js 双重身份的兼容处理，不是小程序代码、微信项目配置或窗口未打开。

### 绕过方式

每次操作前重新调用 `list_windows()` 取得最新窗口 ID，但实际操作时使用微信开发者工具的 `process:` 身份：

```js
globalThis.windows = await sky.list_windows();

const listedWindow = windows.find(
  (window) =>
    window.app === "nwjs._nwjs_mbeehgnikfbgjh.eb2ec0c5982e.Default" &&
    window.title?.includes("微信开发者工具"),
);

if (!listedWindow) {
  throw new Error("未找到微信开发者工具窗口");
}

globalThis.wechatDevToolsWindow = {
  id: listedWindow.id,
  app: "process:F:\\Tencent\\WeChatDevTools\\wechatdevtools.exe",
  title: listedWindow.title,
};

await sky.activate_window({ window: wechatDevToolsWindow });
globalThis.state = await sky.get_window_state({
  window: wechatDevToolsWindow,
  include_screenshot: true,
  include_text: false,
});
```

### 注意事项

- `get_window_state()` 返回的 `state.window.app` 会再次变成 NW.js AppUserModelID，不要把它直接用于下一次操作。
- 后续点击、滚动或重新截图时，继续使用带 `process:` 身份的 `wechatDevToolsWindow`。
- 如果开发者工具重载或重建窗口，先重新执行 `list_windows()`，再更新 `wechatDevToolsWindow.id`。
- 这是本机当前版本组合下的兼容性绕过方式。升级 Codex Computer Use 或微信开发者工具后，应先重新测试标准窗口绑定流程。

## 官方自动化 CLI 无法连接

### 症状

运行 `cli.bat auto` 或 `miniprogram-automator` 时一直等待，最后提示：

```text
工具的服务端口已关闭。
```

### 处理

这个开关属于开发者工具的安全设置，需要用户本人在“设置 -> 安全设置”中开启“服务端口”。不要通过自动化代替用户修改这个设置。

服务端口开启后，先退出所有微信开发者工具窗口，再使用安装目录中的 `cli.bat` 启动自动化。已经普通启动的窗口不会因为追加 `--port` 参数而自动获得服务端口。

### 启动入口

- 正常桌面使用：运行 `F:\Tencent\WeChatDevTools\微信开发者工具.exe`。
- 命令行和自动化：运行 `F:\Tencent\WeChatDevTools\cli.bat`。
- 不要直接运行 `F:\Tencent\WeChatDevTools\wechatdevtools.exe`；它是 NW.js 内核入口，直接运行只会出现名为 `nw.js` 的空壳窗口。
