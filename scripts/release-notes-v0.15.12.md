## v0.15.12 — 修「引擎双启动 / EADDRINUSE 整树崩」

v0.15.11 之后，真机（小米 MIX 2S / Android 10）上仍然存在**引擎被启动两次**的窗口：
一份 `startup-report.txt` 里抓到过完整的 8.4KB 崩溃栈——
`listen EADDRINUSE: address already in use 127.0.0.1:3080`，
最后整棵 cordis 插件树 fail-loud 倒掉，界面停在启动页/超时。

### 根因（三处，都是"把正在启动的引擎当成坏引擎"）

1. **宽限期缺失**
   冷启动要 20-45s 才 bind 端口，而 `startEngine()` 判断"引擎好坏"用的是
   `EngineProbe.check()`（HTTP 探活）。启动窗口里进程活着但还没 listen，
   探活必然失败 → 旧逻辑直接 `existing.destroy()` 再 spawn。
   新旧两个 node 抢 3080，后者必 EADDRINUSE。
   现在加**启动宽限期 60s**：宽限期内"活着但没 bind"= 正在启动，只等不杀；
   超过宽限期还是没起来才杀重启。

2. **进程句柄是实例字段（不是进程级）**
   `engineProcess` 原来挂在 `EngineManager` 实例上，而 MainActivity 与
   EngineService 各 new 了一个 → 一个实例 `stopEngine()` 杀不掉另一个实例
   启动的进程，`engineExited` 也各看各的。现在提到 companion（进程级单例），
   spawn 时刻 `engineSpawnedAt` 一并共享。

3. **重启前没等端口释放**
   原来 `pkill -f bin.js` 之后固定 `sleep(400ms)` 就 spawn——pkill 只是发了
   信号，node 收尾（关 server、flush、退插件树）往往超过 400ms，端口还占着。
   现在改成 socket 真等端口释放（最多 8s），等不到也继续（由引擎自己报错，
   不再是盲发）。

### 附带

- 新增生命周期日志（logcat + 开发者日志双写，不用开开发者开关也能看）：
  `engine booting (ageMs=…) -> wait, not restart` /
  `engine silent for …ms (>60000) -> restart` / `pre-spawn port free=…`。
  下次再出启动问题，一眼能看出是"在等"还是"在杀"。

### 验证（真机）

- 冷启动：引擎 17s bind `127.0.0.1:3080`，`engine.log` / `startup-report.txt`
  里 `EADDRINUSE` 计数 0；界面正常渲染。
- 覆盖安装（versionCode 43），不卸载、用户数据不动。
