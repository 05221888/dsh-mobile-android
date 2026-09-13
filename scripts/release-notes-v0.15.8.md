## v0.15.8 — 让引擎自己说出"哪一条插件挂了"，然后把它隔离掉

**为什么 0.15.4~0.15.7 都没修好**：那几版是在**猜**哪条 cordis entry 有问题
（先默认只留最小集、再四级兜底、再猜 shell-termux / ui-responsive），
但引擎真正的报错一直躺在 engine.log 里没人读。

**本机复现（用手机同一份 snapshot，真跑了一遍引擎）**

1. cordis 是 fail-loud：只要有**一条** entry import/apply 失败，整棵插件树倒、进程秒退。
2. 拿真快照启动，日志原文直接点名：
   `failed to import loader entry sandbox (@deepseek-ai/dsh-sandbox-local)`
   `failed to import loader entry shell-termux (@dsh-android/dsh-shell-termux)`
   `failed to import loader entry ui-responsive (@dsh-android/dsh-client-ui-responsive)`
3. 把那条 entry 关掉后，引擎**正常 bind 端口、HTTP 200**（本机实测 `curl` 拿到 200）。
   ⇒ 失败面就是"某一条 entry"，不是整棵树，也印证了猜是不可靠的。

**v0.15.8 改动**

1. **读日志定位**：每次启动扫 engine.log 原文里的 `failed to (import|apply) loader entry <id>`，
   精确拿到坏 entry 的 id。
2. **自动隔离**：把该 entry 从 `cordis.patch.yml` 摘掉（insert 块整块删；工厂行补 `disabled: true`），
   并记进 SharedPreferences，下次启动也不会再插回来。
   → **重试是收敛的**：每崩一次少一条坏 entry，而不是反复撞同一堵墙。
3. **补引擎可见链接**：patch 里引用、但引擎树里没有的插件（`@dsh-android/*` 这类），
   按 loader 的解析基准（引擎自己的 node_modules）补链接——本机复现证实 loader 就是从
   引擎树解析的。
4. **不再空等**：引擎进程已退出就立刻结束本轮等待，不再死等 75 秒。

**排障**：若仍失败，把 App 私有目录的 `startup-report.txt` 发我（现在会写明隔离了哪条 entry
+ engine.log 末尾 4KB）。
