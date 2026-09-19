## v0.15.17 — 设置面板加「返回」键 + 左滑返回改成关面板（不再退出 App）

用户反馈两件事：
1. **设置没有退出键** —— 原来只有一个 28×28 的 ✕ 图标挤在右上角，和「打开配置文件」
   同一行，小到基本看不见、也难按。
2. **左滑会退出整个 App** —— 想退出设置，结果把 App 退掉了。

### 根因

**退出键**：`VOzbGW_close` 原本是 28×28、`position:static`，夹在 `VOzbGW_header`
的右侧，与「打开配置文件」按钮并排。视觉上只是个小叉，不像"退出"。

**左滑退出 App**：这是历史栈的问题。dsh 的 SPA **从不 pushState**，
所以 `history.length` 永远是 1 → `MainActivity.onBackPressed()` 里的
`webView.canGoBack()` 永远 false → `super.onBackPressed()` → Activity finish。
系统级左滑手势走同一条路，于是直接退出 App。

### 修复

**① 返回键改成显眼的胶囊按钮**

左侧、88×44、「‹ 返回」实心文字 + 主题底色。文字用**真实 DOM 节点**注入
（`<span data-dsh-back-label>`），不用 CSS 伪元素 —— 老 WebView 上
`content:"\2039"` 这类转义不稳，实测渲染不出来。

**② 面板开合与历史栈联动**

- 面板打开 → `history.pushState({dshSettings:1})`
- 系统返回/左滑 → `popstate` → 点一次返回键关面板（**不再退出 App**）
- 点返回键关面板 → `history.back()` 把那条记录弹掉（历史不越堆越多）

用 400ms 轮询而不是 MutationObserver：面板开合不一定触发我们关心的那几种
mutation，而且 pushState 与面板渲染之间有竞态（实测 MutationObserver 会漏）。

### 验证（真机 MIX 2S / Android 10 / WebView 83）

| 场景 | 结果 |
|---|---|
| 面板打开时 history.length | 2（系统返回会被拦下） |
| **按真实返回键**（`input keyevent KEYCODE_BACK`） | **App 存活（pid 不变、仍在前台），设置面板关闭** |
| 点「‹ 返回」 | 面板关闭，history 保持 2（无泄漏） |
| 反复开关 5 次 | history.length 稳定在 2，不累积 |
| 返回键尺寸 | 88×44，OCR 可识别「‹ 返回」 |

### 同批做的设置界面优化（v0.15.16 基础上）

- 面板 300×770（被关在侧栏里）→ **393×770 满视口**
- 模型选择器被截成 `DeepSee…` → **完整显示 DeepSeek-V4.1-Flash**
- 「Agent 预设」卡片描述 603px 被裁 → **换行显示，0 溢出**
- 全页被裁文字扫描：**0 处**
