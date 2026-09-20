

---

# apk-v0.15.0 — DSH-Mobile v0.15.0

创建：2026-09-01T10:50:34+08:00

升级 @dickpy/dsh-imagegen v1.0.5 → v1.5.1（多 provider channels：grok-imagine / nanobanana / seedream-5.0-pro / dall-e-3；centerCol 选择器已被官方原生支持），升级 dsh-notify-sound v0.1.0 → v0.1.1（更细的会话状态触发），新增 dsh-mobile-nv-failover 插件：手机本地 NVIDIA NIM（integrate.api.nvidia.com/v1）key 池轮换 + 自动 failover，nvapi- 密钥只存设备本地（~/.dsh/dsh-mobile-nv-failover/keys.json，0600），APK 不含任何密钥。所有原有功能插件保留。

**下载方式**：APK 已 xz 压缩（128MB → 78MB），下载后用 `xz -d DSH-Mobile-0.15.0-debug.apk.xz` 或 7-Zip 解压得到 .apk。


---

# apk-v0.15.1 — apk-v0.15.1

创建：2026-09-01T13:30:51+08:00

DSH-Mobile v0.15.1 (vc32) 行为修复

## 修了什么

**v0.15.0 安装失败根因 + 修复**：

1. **manifest sha256 字段错位**：v0.15.0 url 是 .apk.xz，但 sha256 误填 APK 解压后值 → UpdateManager 校验通过后把 xz 流直接喂给系统安装器 → 触发「解析软件包时出现问题(33) PackageInfo is null」
2. **PhoneSettingsActivity 漏解压**：代码下载完成直接把 xz 流当 APK 装，缺一步 xz → APK 解压
3. **修复**：① manifest sha256 与 url 严格对齐 ② downloadApk 后用 commons-compress 的 XZCompressorInputStream 解压再交给安装器

## v0.15.1 新形态

- APK 81MB ≤ Gitee 100MB 单附件上限，url 改回 `.apk` 直接传
- xz 解压逻辑保留（兼容旧 manifest，未来超 100MB 也能用）
- 更新内容与 v0.15.0 相同（imagegen 1.5.1 / notify-sound 0.1.1 / 新增 nv-failover）

## 下载

- APK: https://gitee.com/wushenghuang/dsh-mobile-releases/releases/download/apk-v0.15.1/DSH-Mobile-0.15.1-debug.apk
- 大小：81MB
- SHA256: bb472bdc97cf5a69dc868469d3c65d86ec821407493fba888f51309a25600b33

## 升级建议

覆盖安装，不会丢现有数据。手机端点「检查 App 更新」即可看到 0.15.1。



---

# apk-v0.15.2 — DSH-Mobile vv0.15.2

创建：2026-09-13T14:01:25+08:00

## v0.15.2 - 修「装完用不了」

**症状**：v0.15.0 / v0.15.1 装在手机上，界面卡在「正在启动引擎…」，两次超时后提示「引擎启动超时，请重试」，进不去聊天。

**根因（两条叠加）**

1. v0.15.0 把 AI 生图插件从 1.0.5 升到 1.5.1 时，**把插件自带的 node_modules 一起丢了**（schemastery / @deepseek-ai/cosmokit / @standard-schema/spec）。手机快照里只有作用域版 `@deepseek-ai/schemastery`，没有顶层 `schemastery`，于是插件顶部的 `import z from "schemastery"` 直接 `ERR_MODULE_NOT_FOUND`。dsh 的插件加载是 fail-loud（一个插件挂掉整棵 cordis 树倒），引擎就再也没起来。
2. 生图插件在插件表里被标成 `safe: true`，而一级兜底的判据正是 safe → **安全模式关不掉它**，两次 90 秒都超时，手机上永远进不去。

**修复**

- 恢复生图插件随包 `node_modules`（schemastery 3.18.1 + cosmokit + @standard-schema/spec），App 里已核对打包内容。
- 引擎侧新增**裸依赖兜底**：启动时把 `schemastery` / `ws` 这类裸名做成 symlink 指向快照内的作用域版，以后插件升级再丢依赖也不会把引擎拖死。
- 插件铺装改为**版本感知**：内置包版本和手机里不一致就整目录重铺（老逻辑「有 package.json 就跳过」会让手机永远跑旧插件）。
- 生图插件 `safe` 改 `false`；新增**二级兜底**（只留启动必需插件）。
- 启动流程改为**三级兜底**：全部开启 → 只留 safe → 只留 bootCritical，保证「至少能进聊天」。

**升级提示**：直接覆盖安装即可，不要卸载（数据在私有目录，覆盖安装会保留）。升完第一次启动会自动重铺生图插件，稍等十几秒。



---

# apk-v0.15.3 — DSH-Mobile vv0.15.3

创建：2026-09-13T14:49:29+08:00

## v0.15.3 - 真的修好「用不了」（v0.15.2 修得不彻底）

**v0.15.2 为什么没修好**：它只在"内置插件版本 ≠ 手机里的版本"时才重铺插件目录。可手机上坏掉的
生图插件恰好也是 1.5.1（版本一样，只是随包 node_modules 丢了）→ 被判定"无需重铺"跳过 → 依旧起不来。

**v0.15.3 三层保险**

1. **插件树完整性标记**（`.dsh-bundled.json`）：版本 + 资产文件数 + App versionCode 三者全中才跳过重铺。
   老版本铺的目录都没有这个标记 → 升级后**一律重铺一次**，随包依赖必定就位；App 每次升版也会重铺。
2. **插件依赖预检**（引擎启动前跑）：
   - 插件 entry 里的裸 import（如 `schemastery`）在插件自己 / profiles 两处 node_modules 都找不到时，
     自动从引擎自带的 node_modules 借（symlink，支持"裸名 → @deepseek-ai/名"改名映射，悬空链接会自动替换）；
   - 实在借不到 → **直接关掉那个插件**并记日志。cordis 是"一个插件挂掉整棵树倒"，宁可少个功能也不能进不去聊天。
3. **三级启动兜底**：全部开启 → 只留 safe 插件 → 只留启动必需插件（75s / 60s / 60s）。

**排障利器**：启动后会在 App 私有目录写 `startup-report.txt`（自动关闭了哪些插件 + engine.log 末尾 4KB）。
以后手机再出问题，把这份文本发出来就能定位。

**升级提示**：覆盖安装，不要卸载。第一次启动会重铺内置插件（约十几秒）。



---

# apk-v0.15.4 — DSH-Mobile vv0.15.4

创建：2026-09-13T15:29:24+08:00

## v0.15.4 — 保证「装完能进聊天」

**v0.15.3 为什么仍可能用不了**

1. 默认把 imagegen / 记忆系统 / 记忆互通等重型插件全开；任何一环坏掉，cordis fail-loud 整树倒。
2. 三级兜底最后仍保留 bootCritical；快照自带 `ui-layout` 被禁用，ui-responsive 一坏界面全空（同类项目 kelai141 已证实这是致命项）。
3. 视觉 MCP 在无 key 时也强制挂载，子进程失败同样拖垮引擎。

**v0.15.4 修复**

1. **默认只开最小集**：安卓控制 + 删除会话。其余插件默认关闭，进聊天后在「手机设置」按需打开。
2. **四级启动兜底**：当前集合 → safe → bootCritical → **裸引擎**（目录插件全关 + 剥 mcp-vision + 修 ui-layout）。
3. **工厂语义纠正**：ui-responsive 缺失时强制 re-enable `ui-layout`，避免「引擎在但界面死」。
4. **依赖预检加深**：扫入口 + 随包 node_modules 一层；空壳 entry 直接判坏并关掉非关键插件。
5. **视觉 MCP 懒加载**：只有配置了 `dashscope-key.txt` 才写入 cordis。

**升级方式**：覆盖安装，不要卸载。首次启动会重铺内置插件并按最小集启动。

**排障**：仍失败请把 `startup-report.txt`（App 私有目录）发来。



---

# apk-v0.15.5 — DSH-Mobile vv0.15.5

创建：2026-09-13T15:38:06+08:00

﻿v0.15.5 修复「检查 App 更新失败：Input is not in the xz format」。应用内更新此前无条件把下载文件当 xz 解压，而 0.15.x 发布的是裸 .apk。现按魔数识别 ZIP/XZ：是 APK 直接安装，是 xz 才解压。覆盖安装本包后，应用内更新可正常工作。



---

# apk-v0.15.6 — DSH-Mobile vv0.15.6

创建：2026-09-13T15:47:44+08:00

v0.15.6 修「引擎未运行，正在自动恢复」卡死。

根因：
1) 探活只认 HTTP 200，启动中 401/404/503 被当成死引擎；
2) startEngine 在 90s 冷却窗口内直接 return true 却不拉起进程 → 看门狗空转；
3) 旧 stripInsert 只删 3 行，config 孤儿行会弄坏 cordis YAML。

修复：
- 任意 HTTP 响应都算引擎在；
- 冷却仅在进程仍存活时生效；进程死/僵尸立刻清冷却；
- 15s 内早夭自动清冷却；探活失败强制重启；
- 每次启动把 web cordis 重置为出厂工厂件再按开关写入；
- stripInsert 吞掉完整 insert 块（含 config 子树）。

覆盖安装 0.15.6，不要卸载。若仍失败请发 startup-report.txt。


---

# apk-v0.15.7 — DSH-Mobile vv0.15.7

创建：2026-09-13T16:02:01+08:00

v0.15.7：打断「引擎未运行→自动恢复」死循环。

根因：cordis 插件 Promise.allSettled 失败后进程立刻退出；看门狗 5s 又拉，无限重启；界面只显示堆栈尾巴看不到真错误。

修复：
1) 15s 内连续早夭 ≥2 次 → 自动切 ultra-safe cordis（去掉 shell-termux / ui-responsive，回到官方 bash-sandbox + ui-layout）
2) 探活成功后清零早夭计数；失败重启间隔 8–15s，不再 5s 狂拉
3) engine.log 摘要改为优先显示 Error/failed 行 + 末尾 40 行，便于定位具体插件

覆盖安装后：等约 1 分钟（会自动尝试两次再切安全模式）。若仍失败，把引导页上的 engine.log 摘要截图发我。


---

# apk-v0.15.8 — DSH-Mobile vv0.15.8

创建：2026-09-13T23:57:19+08:00

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



---

# apk-v0.15.9 — DSH-Mobile vv0.15.9

创建：2026-09-14T01:35:32+08:00

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



---

# apk-v0.15.10 — DSH-Mobile vv0.15.10

创建：2026-09-14T11:53:01+08:00

## v0.15.10 — 修「运行时更新失败，请重试」

v0.15.9 的体检已经正确发现了坏运行时（所以这次不再是"插件"问题了），但**换运行时的动作本身失败**，
界面就停在「运行时更新失败，请重试」。

两个原因，都修了：

1. **解压撞上旧文件就整次崩**（主因）
   覆盖解压时，tar 里某条目要放的位置如果被**非空目录**占着，代码走的是
   `Files.deleteIfExists` —— 它对非空目录会抛 `DirectoryNotEmptyException`，而这里没有兜住，
   整次解压直接中断。旧运行时残骸正好制造这种冲突（目录/文件类型对不上）。
   现在改成 `forceDelete()`：文件、目录、悬空链接都能先清干净；目录条目遇到被文件占位也先清。

2. **解压前没清场**
   现在刷新运行时会先 `dropForeignRuntime()` + `wipeRuntime()`：把外来 npm 树移开、
   把 `usr/` 整棵删干净（含符号链接，只删链接本身）再解压。空间也更宽裕
   （运行时解压后约 570MB）。

另外修掉一个"越修越坏"的隐患：换上新运行时后会**同时清掉旧 engine.log 与隔离集合**。
否则上一次坏树留下的 `failed to import loader entry ...` 会被当成新运行时的报错，
把本来正常的插件永久关掉。

体检清单也校准了：`profiles/node_modules/@deepseek-ai` 下那 195 条本来就指向 Termux 的链接
**不再**算作"运行时损坏"（它们由重指逻辑修复）。之前若算进去，会变成每次启动都重解压。

**失败也不再是死路**：真失败时会把原因（含磁盘可用空间、usr 是否存在）写进
`startup-report.txt`，方便回传定位。

覆盖安装，不要卸载。第一次启动会清场重解压（约十几秒到一分钟）。



---

# apk-v0.15.11 — DSH-Mobile vv0.15.11

创建：2026-09-14T20:09:16+08:00

## v0.15.11 — 修「运行时更新失败，请重试」+ 老 WebView 起不来

真机验证：小米 MIX 2S / Android 10 / MIUI 出厂 WebView（Chromium 83）。
修完三个缺陷后引擎正常 bind :3080，网页界面完整渲染，控制台零报错。

### 1. 「运行时更新失败，请重试」的真正原因：崩在**备份**，不是解压

`refreshSnapshot()` 原来用 `dsh.copyRecursively(backup)` 整棵拷 `.dsh`。快照
`profiles/` 下有 **510 条**指向 Termux 私有目录的绝对符号链接，在本 App 里全是
悬空链接；Kotlin 的 `copyRecursively` 逐条目用 `File.exists()`（**跟随链接**）
判断，悬空即走 `onError`，而默认 `onError` 就是**抛出** → 整次备份中断 → 异常
冒到 `catch (Throwable)` → `return false` → 界面就显示这句话。

v0.15.9 引入「体检不过就强制重解压」之后，这段备份才**第一次真正跑起来**，于是
现象从「引擎起不来」变成了「运行时更新失败」——**崩在备份这一步**，而不是
v0.15.10 以为的解压那一步（它改的 `forceDelete` / 清场都在备份之后，所以没用）。

改法：只精确备份 7 项用户数据（sessions / storages / attachments /
.credentials.yaml / settings.yaml / .anonymous-user-id / .private-layout），
用 `copyTolerant()`：悬空链接只删链接本身、不跟随目标。备份不完整就**中止本次
刷新**并写原因，绝不在数据没备份好的情况下去清场。
顺带修掉一个潜在数据丢失：旧布局下 `sessions`/`storages` 是链接，
`deleteRecursively` 会跟随链接删掉**真实目标目录**的内容，改用 `deleteEntry()`
后只删链接。

### 2. node-pty 加载失败会拖垮整棵插件树（引擎永远起不来）

`pty.node` 需要 `_Unwind_Resume`，但快照里 Termux 版 `libc++_shared.so` 把
unwinder 符号留成 **hidden**。实测：它是快照里 **483 个 ELF 中唯一引用该符号的
文件**，全库无人提供；bionic 的 `/system/lib64/libc++_shared.so` 是另一套 ABI，
换上去反而让 node 起不来。

`@deepseek-ai/dsh-subprocess-local` 在模块顶层 `import node-pty`，而 cordis 是
**fail-loud**：一条 import 失败整棵树倒，进程立刻退出，端口永远 bind 不上。

改法：把 `loadNativeModule` 的失败**降级**为"用到才报错"。普通子进程走
`child_process`，不受影响；只有交互式终端（`spawnTerminal`）不可用。

### 3. 前端 bundle 用了 Chromium 83 解析不了的语法 → 永久停在 Loading plugins

Android 10 MIUI 出厂 WebView 是 Chromium 83，而 dsh 前端用了
`??=` / `||=` / `&&=`（Chrome 85）和私有类成员（Chrome 84）。这是**语法**错误，
polyfill 救不了 —— 真机实测 8 个 bundle 报 `Unexpected token '='`，
ui-responsive 报 `Unexpected token '('`。

- App 自带前端资产按 Chromium<85 **就地降级**：只改这些表达式，其余字节不动
  （`??=` 之类会被重写成 `a ?? (a = (rhs))`；嵌套成员如 `schema.meta.badges`
  会把基对象提到临时变量，保证只求值一次 —— getter 会被读两次的反例已修）
- 只存在于快照里的 9 份 bundle 放 `assets/patched-web-legacy/`，用 manifest 里
  「原文件 sha256」门控替换：幂等、不覆盖别人改过的、快照换代自动跳过
- 运行时 API（`Object.hasOwn` / `Array.at` / `structuredClone` / `replaceAll` /
  `WeakRef` / `AbortSignal.any` …）补进 `compat-polyfills.js`，并**内联进
  `web-frontend-index.html`**（`onPageStarted` 注入对 `<head>` 里的 module script
  来说太晚，页面已经报错了）
- `applyAssetPatch` 改为**多标记**：内容标记（如 `onImagePicked`）不随补丁内容
  变化，升级安装时旧文件带着旧标记会被误判"已打过"而跳过，新补丁永远铺不上

### 配套

`scripts/web-legacy/` 固化降级工具链：`es83.mjs`（转换器）+ 生成脚本 + 语义测试
21 例，含两个真实反例（getter 基对象必须只读一次、`&&=` 逗号右值必须加括号，
否则 `a = b, c` 会按 `(a = b), c` 解析而丢掉右半部分）。

### 说明

- 交互式终端（`spawnTerminal`）在本版仍不可用（原因见第 2 条，需要重建
  android-arm64 的 `pty.node`）；聊天、工具调用、文件操作等走 `child_process`
  的功能正常。
- 如果你的 WebView 比 83 新，这些兼容补丁同样安全（改写语义等价）。

---

# apk-v0.15.14 — DSH-Mobile vv0.15.14

创建：2026-09-19T18:57:42+08:00

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



---

---

# apk-v0.15.15 — DSH-Mobile vv0.15.15

创建：2026-09-19T21:39:14+08:00

## v0.15.15 — 修「设置页划不到底，配不了自定义提供方的 API Key」

用户实测：手机点开「设置 → 模型 → 添加模型 → 自定义提供方」后，**表单划不到底**，
API 密钥输入框和「创建提供方」按钮在屏幕外，配不了密钥。

### 根因：WebView 83 解析不了 CSS `inset` 简写（Chromium 87 才有）

dsh 自己的面板 CSS 是：

```css
.VOzbGW_overlay { position: fixed; inset: 0; }
```

`inset` 是 Chrome 87 才有的简写。本机是 **Chromium 83**，整条声明被**丢弃** →
`position: fixed` 没有偏移量，元素回落到 **static position**（也就是它在文档流里的位置：
侧栏 footer 之后）→ 面板被摆到屏幕外/被裁掉，只剩浏览器把隐藏溢出的容器滚上来露出的
上半截，于是「划不到底」。

同一个坑还影响其它弹层（生图弹窗、输入框覆盖层等都是 `position:absolute/fixed;inset:0`）。

### 两处修复

1. **运行时 CSS `inset` shim**（`assets/js/compat-polyfills.js`，已内联进 `web-frontend-index.html`）
   引擎不支持 `inset` 时，在样式文本进引擎前把简写展开成 `top/right/bottom/left`：
   - 覆盖已有的 `<style>`、MutationObserver 盯动态插入/改写的 `<style>`（dsh 的 CSS 都这么注入）、
     以及 CSSOM 的 `insertRule` / `replaceSync`；
   - 正确处理 1~4 值简写与 `!important`，`calc()`/`var()` 里的空格不误切；
   - 不碰 `--x-inset:`、`inset-inline-start:`、`box-shadow: inset`；
   - 新内核（`CSS.supports('inset','0')` 为真）直接跳过，桌面端零影响。
2. **移动端抽屉不再用 transform 位移**（`patched/dsh-android-control/lib/client.js`）
   `transform` 会让 `position:fixed` 的后代以抽屉为参照系（fixed 失效）→ 面板被关进
   301px 宽的抽屉里。改成 `left` 位移；并给设置面板显式写四个方向做双保险。

### 附带修掉：内置插件每次启动都被判定「拷贝不完整」→ 全量重铺

`syncPluginTree` 里 `copied = countFiles(target) - 1`（减掉标记文件自身），但拷贝前目录要么是
新建、要么刚被 `deleteRecursively` 过，标记文件根本不存在 → 每次都算成 `N-1/N` → 删标记 →
下次启动再重铺一遍。真机日志里每个内置插件每次启动都刷 `re-layout` + `copy incomplete`
就是这个（还会让 `.dsh-bundled.json` 永远写不上）。改成只在实际存在标记时减。

### 验证（真机 MIX 2S / Android 10 / WebView 83）

- `CSS.supports('inset','0') === false`（确认根因）；
- 设置面板：`overlay = 0/770/393`（满视口，原来在屏幕外）、`panel = 24/746/393`、
  选项列表 `bottom = 746 < 770` 且能滚到最大值；
- 自定义提供方表单：`Provider ID / 显示名称 / API 地址 / API 协议 / API 密钥 / 模型目录 /
  创建提供方` **全部落在视口内**（原来「创建提供方」在 y≈1943px，屏幕外）；
- 插件标记正常写入：`{"version":"0.2.5","files":4,"appVersionCode":46}`，启动日志不再刷
  `copy incomplete`。



---
