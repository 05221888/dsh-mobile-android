v0.15.19 修复「点击输入框键盘不出来」+ 键盘避让改用页面内抬升

用户反馈：v0.15.18 之后**点击输入框键盘不出现**。

一、根因（真机逐条对照定位，结论明确）

v0.15.18 的键盘避让做法是「页面报焦点 → 壳收缩 WebView 布局高度」。真机事件序列是：

    touchstart → touchend → focusin → mousedown → mouseup → click

focusin 夹在 touchend 与浏览器**合成的 mousedown 之间**。旧代码在 focusin 里立刻
收缩 WebView / 位移 composer，于是：

1. WebView 布局在 IME show 请求在途时被改动 → 这次 show 作废；
2. 等合成的 mousedown 派发时，手指坐标下的元素已经换人（落到 scrollBody 上），
   浏览器随即把焦点从 textarea 抢走（focusout），键盘再也没机会弹出。

对照实验（决定性）：
- 把抬升位移量强制为 0px、其余逻辑完全不变 → mousedown 命中 TEXTAREA、焦点留住、
  `mInputShown=true`，**键盘正常弹出**；
- 恢复位移 → mousedown 落到 scrollBody、焦点丢失、`mInputShown=false`。

排除项：IME 本身正常（同一时刻在 MIUI 设置搜索框里 mInputShown=true），
不是输入法坏了，也不是 WebView 或系统问题。

二、修复

1. **壳不再改 WebView 尺寸**（MainActivity.applyKeyboardShrink 只留日志），
   页面坐标系与点击命中完全不受影响；
2. 抬升改为**页面内 transform**，且**推迟到触摸序列结束之后**再动布局
   （compat-polyfills.js 的 scheduleLift，延迟 50ms）—— 抬手后位移不再影响命中判定；
3. 抬升只作用于 composerStack 的 transform：实测再给 scrollBody 加 padding-bottom
   会与之叠加，composer 会飞到屏幕上部（y 632 → 78），故不使用；
4. 收回逻辑加固：focusout + click + 页面 blur/切后台 + 500ms 轮询兜底
   （返回键收键盘时焦点常残留在输入框上，只靠 focusout 收不回来）。

三、真机验证（MIX 2S / Android 10 / WebView 83 / 微信输入法）

完整回归（坐标为页面实测，不靠拍屏猜）：

   启动后               composer y 632，lifted=false（自动聚焦但不误抬）
   点输入框 #1          IME=true，composer y 632 → 355
   打字                 "hello" 正常显示在输入框里
   点消息区收键盘        IME=false，composer 还原 y 632
   再点输入框 #2        IME=true        ← v0.15.18 这里必定失败
   再收再点             IME=true
   BACK 收键盘          IME=false，App 未被退出
   BACK 后再点          IME=true
   连点 5 次            5/5 成功

四、顺带修掉的两个问题

1. **返回键会误退 App**：IME 窗口是 `fl=NOT_FOCUSABLE` 的独立 overlay，自己不吃
   返回键；键盘弹着时按返回 / 左滑，事件直接落到 Activity，而 dsh 的 SPA 从不
   pushState（canGoBack 恒 false）→ 整个 App 被退到桌面。
   现在 MainActivity.onBackPressed 先判断「键盘是否抬起」，是则只收键盘。
2. **抬升状态去重**：早期实现里 500ms 轮询每轮都写 classList + 打桥日志，
   logcat 被刷屏。改为状态不变就不动手。

五、键盘高度：量准（最终值 1352，不是 1292）

用户反馈「输入框和键盘之间还有缝隙」，据此重新校准。

**测量方法（关键，走了弯路）**：必须先把抬升量钉成 0 再拍「键盘弹出 / 收起」两张
截图做逐行差异 —— 否则抬升动作本身会污染差异，读出来的边界是 composer 的而不是
键盘的（我就因此先得到 1292、后得到 1146 两个错误值）。
另外本机键盘底色 (20,20,20) 与页面底色 (18,18,18) 极接近，
用"亮度阈值"扫描会整个漏掉，必须做像素差异或找那条分隔线（亮度约 55）。

**最终实测**：键盘顶边 = **1352 物理像素** → 1352/2160 = 0.6259。
验证：`window.screen.height`(786 CSS) × 0.6259 = 492 CSS = 1353px ✓

之前写 1292/2160 是在**候选栏展开**时读到的值；候选栏收起后键盘变高、顶边升到 1352，
于是卡片底边比键盘高出 59px —— 正是用户看到的那条缝隙。

修复后实测（像素级）：卡片底边 1353px，键盘顶边 1352px，y=1352 是键盘顶部分隔线，
y=1354 起即为键盘内容，中间无背景露出。

六、顺带修掉的两个问题

1. **返回键会误退 App**：IME 窗口是 `NOT_FOCUSABLE` 的独立 overlay，自己不吃返回键；
   键盘弹着时按返回，事件直接落到 Activity，而 dsh 的 SPA 从不 pushState
   （canGoBack 恒 false）→ 整个 App 被退到桌面。现在先判断键盘状态，是则只收键盘。
   实现上用 `dispatchKeyEvent` 而不是 `onBackPressed`（真机实测键盘弹着时
   `onBackPressed` 根本不会被调用）。
2. **返回键收键盘后，页面不知道键盘没了**：textarea 仍是 activeElement，
   composer 会一直悬在屏幕中间，用户去点底部原来输入框的位置反而落空。
   新增桥方法 `isKeyboardShown()`（`InputMethodManager.isAcceptingText()`），
   真机验证与键盘可见性完全一致且**不需要 DUMP 权限** —— 对比之下
   `dumpsys input_method` 与 `dumpsys window` 普通 app 身份都读不到
   （`Permission Denial: missing android.permission.DUMP`）。
   页面 300ms 轮询它，让抬升严格跟随键盘真实存在。

七、真机验证（MIX 2S / Android 10 / WebView 83 / 微信输入法）

   连点输入框 6 次                6/6 成功
   点输入框 → 键盘弹出             composer 卡片底边 1353px vs 键盘顶边 1352px
   打字                           文字正常显示
   点消息区收键盘                 位置还原
   再点输入框                     正常（v0.15.18 这里必定失败）
   BACK 收键盘                    App 未被退出

八、已知取舍

- 键盘高度按**屏高比例**（1352/2160）算，本机微信输入法实测稳定。
  换输入法若高度不同，调 KB_TOP_RATIO 一个常量即可。
- `adb shell input keyevent 4` 走 MIUI 系统广播（`miui.intent.KEYCODE_BACK`），
  不经过 App 的 `dispatchKeyEvent` —— 用它测返回键路径测不准，以手工验证为准。
