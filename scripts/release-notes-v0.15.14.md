## v0.15.14 — 修「界面白屏 / 渲染进程崩溃把 App 带走」

Android WebView 的渲染进程是**独立进程**，低内存老机器上会被系统杀掉。
真机 logcat 已经抓到过一次：

```
E chromium: [ERROR:aw_browser_terminator.cc(125)] Renderer process (22369) crash detected (code -1).
```

而 App 里**没有实现 `onRenderProcessGone`**，后果是两条都很难受：

- 不实现（或返回 `false`）：系统认为你没处理，**直接杀掉整个 App**；
- 返回 `true` 但不重建：WebView 变成一个死视图，**页面永久白屏**，只能划掉重开。

### 修法

在 WebViewClient 里实现 `onRenderProcessGone`：

1. 返回 `true`（声明已处理，避免系统杀 App）；
2. 记日志（logcat + 开发者日志）：`webview render process gone (didCrash=…)`；
3. 销毁死 WebView，然后 `recreate()` 重建 Activity（v0.15.13 起 onDestroy 不再杀引擎，
   所以重建不会打断引擎，页面回来就能直接连上已在跑的引擎）；
4. **防死循环**：进程级节流，60s 内最多自愈 3 次；超了就停在引导页
   提示「界面进程反复崩溃，已停止自动恢复」，不再无限重建。

### 验证（真机 MIX 2S / Android 10）

- 覆盖安装（versionCode 45），冷启动引擎 17s bind，界面正常渲染；
- 冷启动 + 后台杀掉引擎 + 看门狗自愈链路回归通过（v0.15.12/13 的修复未回归）。
