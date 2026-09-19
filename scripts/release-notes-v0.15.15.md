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
