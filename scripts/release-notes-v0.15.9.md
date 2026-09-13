## v0.15.9 — 真凶抓到了：引擎在"外来残树"里跑

**你截图里的报错（这次读到了）**

```
failed to import loader entry subprocess (@deepseek-ai/dsh-subprocess-local):
  Cannot find package '@deepseek-ai/dsh-subprocess-local'
  imported from /data/user/0/com.dshmobile.shell/files/home/.dsh/profiles/web/
failed to import loader entry sandbox (@deepseek-ai/dsh-sandbox-local):
  Cannot find the native Koffi module; did you bundle it correctly?
```

而堆栈里的 loader 来自：

```
/data/data/com.dshmobile.shell/files/home/ds/tmp-upgrade/package/node_modules/@deepseek-ai/cordis-plugin-loader/...
```

**关键就在这一行**：引擎不是在 App 自己的运行时（`files/usr/...`）里跑，而是在
`files/home/ds/tmp-upgrade/package/` 这棵**外来/半成品 dsh 树**里跑。所以：

1. profile 里的 `@deepseek-ai/*` 链接指向别人的目录（Termux 那套），核心包解析不到
   → `dsh-subprocess-local` 找不到；
2. 那棵残树里没有 koffi 的 `android_arm64` 原生库 → `Cannot find the native Koffi module`；
3. 而 `snapshotFresh()` 原先只要 `.online-fingerprint` 存在就认为运行时没问题，
   于是这棵坏树**永远不会被换掉** —— 这才是"一直打不开"的真正原因，跟你装哪个 APK 无关。

**v0.15.9 修复**

1. **运行时体检**（每次启动、启动引擎前）：检查 node / termux-exec / dsh 本体 /
   dsh-app-boot / cordis-plugin-loader / dsh-base / dsh-subprocess-local /
   dsh-sandbox-local / koffi(android_arm64) 是否都在**本 App 的 usr 内**，
   并检测有没有"外来 node_modules 根"在劫持解析。任一项不过 → 强制用内嵌快照重解压。
2. **清场**：把 `home/node_modules`、`home/.dsh/node_modules` 这类外来 npm 树改名移开，
   并删掉 `home/ds/tmp-upgrade`（截图里引擎的启动目录）。用户数据不受影响。
3. **重指 profile 链接**：`home/.dsh/profiles/**/node_modules/@deepseek-ai/*` 只要指向
   App 运行时之外，一律重指到本 App 的引擎树（快照内 195 条链接的目标全部实测存在）。
4. 保留上一版的"读 engine.log 隔离坏 entry"与"补引擎可见链接"。

**本机验证**（用你手机同一份 snapshot 真跑引擎）

- 复现你的报错：把 profile 链接指到外来树 → `Cannot find the native Koffi module`
  + `failed to import loader entry sandbox`（与你截图一致）；
- 应用本版修复（重指到本 App 运行时）后启动 → **HTTP 200**（本机 curl 实测）。

**注意**：本版第一次启动会做一次运行时体检，可能需要等十几秒到一分钟（必要时重解压）。
覆盖安装，不要卸载。
