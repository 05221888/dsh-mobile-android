## v0.15.16 — 修「设置界面乱码 / 文字被裁 / 空间狭窄」

用户反馈：设置面板里"有很多乱码，空间也比较狭窄"。真机排查发现是**三处布局缺陷**叠加，
而且都不是"字体问题"，是文字被容器裁掉了。

### 根因与修复

**① 设置面板被关进 300px 宽的侧栏抽屉里（主因）**

`._3HOSdG_mobileDrawer` 带 `transform`（即使是单位矩阵 `matrix(1,0,0,1,0,0)`），
而 CSS 规范里**任何非 none 的 transform 都会让 `position:fixed` 的后代以它为参照系**。
设置面板本身是 `position:fixed; inset:0`，于是"满屏"变成了"抽屉那 300px"：
中文一字一行、按钮文字折行、右侧内容被裁 —— 看起来就是乱码。

修：抽屉改用 `left` 位移（`left:-100%` ↔ `[data-open] left:0`），transform 保持 none，
fixed 恢复以视口为参照。

**② 模型选择器文字被截断**

底部输入区的模型按钮被限死在 `max-width:118px`，而 "DeepSeek-V4.1-Flash" 需要 128px
→ 显示成 `DeepSee…`（用户看到的"乱码"之一）。

修：放开 `_7KE1Ra_*` 的宽度上限，并给行尾工具条留间距。

**③ 「Agent 预设」卡片描述被裁成半截**

`cardDesc` 是 `display:-webkit-box` + `white-space:nowrap` + `overflow:hidden`，
文字实际宽度 603px 而容器只有 393px → 后半句直接消失。

修：改回 `display:block` + `white-space:normal`，允许换行、`overflow-wrap:anywhere`。

### 配套：设置面板整体移动端布局

- 导航从「左侧竖排」改成**顶部横向滚动条**（窄屏才放得下 5 个页签）
- 面板 `width:100vw; height:100%`，去掉圆角，占满视口
- 内容区 `overflow-y:auto` + `min-height:0`（flex 子项才能正确滚动）
- 输入框 `font-size:16px`（防系统自动放大导致横向溢出）

### 实现位置

这些 CSS 走 **壳侧注入**（`assets/js/compat-polyfills.js` → 内联进首页），
不走 `dsh-android-control` 插件。原因：该插件的 client 半边在当前内核下**没有被注册**
（它的 `dsh.client` 声明缺 `inject` 字段，`dsh-client-modules` 不接受），
写在那里是死代码 —— 这也是为什么 v0.15.15 的移动端 CSS 一直没生效。

### 验证（真机 MIX 2S / Android 10 / WebView 83）

| 项 | 修复前 | 修复后 |
|---|---|---|
| 设置面板尺寸 | 300×770（= 抽屉宽度） | **393×770（满视口）** |
| 模型选择器 | 67px / 需要 128px（`DeepSee…`） | **125px / 125px 完整显示** |
| Agent 预设卡片描述 | 603px 宽，被裁 | 换行显示，**0 溢出** |
| 全页被裁文字扫描 | 多处 | **0 处** |
| 各页签横向溢出 | Agent 预设 3 处 | **全部 0 处** |
