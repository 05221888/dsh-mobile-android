## v0.15.13 — 修「后台引擎死了没人拉，通知却还写着运行中」

App 从第一天就写着"保活：前台服务 + 看门狗（引擎崩溃自动重启）"，
但看门狗**在正常启动路径上从来没装上过**。

### 根因

`EngineService.ensureEngine()` 长这样：

```kotlin
if (EngineProbe.check().running) { earlyCrashCount = 0; return }   // ← 直接 return
if (engineManager.engineReady && engineManager.startEngine()) { armWatchdog() }
```

而 MainActivity 的启动顺序是：**先把引擎拉起来（等 bind 成功）→ 再 startForegroundService**。
所以服务 onCreate 时引擎已经在跑，第一个 probe 就命中 `return` ——
`watchdog` 永远是 null。只有"服务被系统重启、且当时引擎正好是死的"这一条罕见路径才装得上。

后果：引擎在后台崩掉/OOM/被厂商省电杀掉之后，
- 前台服务还活着，通知还写着「dsh 引擎运行中」；
- 没有任何东西去重启引擎；
- 用户打开 App 才被 MainActivity 的 3s 前台监控救回来（Activity 一旦被回收，连这个也没了）。

### 修法

1. **看门狗与"这次是不是我启的引擎"解耦**：只要运行时（`usr/bin/node`）在位就装上，
   不再依赖"这次是我 spawn 的"。
2. **看门狗不再无脑清冷却**：原来每次 tick 都 `lastStartAttemptAt = 0` 再 startEngine，
   等于绕过 90s 冷却去逼一次"杀重启"。现在只在**进程真的死了**（`engineExited`）时清冷却；
   进程还在（正常启动窗口）就交给 `startEngine` 的 60s 宽限期判断。
3. **onDestroy 不再杀引擎**：引擎生命周期的所有者是前台服务。
   原来划掉界面 → `onDestroy` → `stopEngine()` → 8s 后看门狗又把它拉起来：
   白等一次 20s 冷启动，还正好制造"旧进程没退干净、新进程抢 3080"的 EADDRINUSE 窗口。
   现在划掉界面引擎继续跑（保活真的生效，与通知文案一致）。
   要停引擎：系统设置 → 应用 → 强制停止。

### 验证（真机 MIX 2S / Android 10）

- 杀掉引擎进程（`kill -9`）后：前台监控 10s 内拉回，`pre-spawn port free=true`，
  `engine.log` / `startup-report.txt` 里 `EADDRINUSE` 计数 0。
- 看门狗日志：`watchdog: engine down (exited=…), restarting` 现在能在 logcat 看到。
- 覆盖安装（versionCode 44），不卸载、用户数据不动。
