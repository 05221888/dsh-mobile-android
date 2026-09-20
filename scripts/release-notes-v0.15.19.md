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

五、键盘高度：从"按比例估"到"量准"

用户反馈「输入框和键盘之间露出一点点背景」，据此把高度量准了。

**关键数据（真机 dumpsys）**：IME 窗口 `mGivenContentInsets=[0,1292][0,0]`，
格式是 `[left,top][right,bottom]` —— 含义是**键盘顶边在 y=1292 物理像素**，
即键盘高 2160-1292 = 868px（占屏高 40.2%）。
起初我误读成"键盘高 1292"（等于按 60% 估），抬过头，卡片下方露出约 24px 背景。
截图像素扫描独立验证：y=1292 处底色由 (18,18,18) 跳成 (32,32,32)。

**又踩一个坑**：`window.screen.height` 返回的是 **CSS px（本机 786）**，
不是物理像素 —— 我开始又除了一次 dpr，算成 171，抬升量直接翻倍（卡片飞到屏幕上部）。
正确算式：`786 x 1292/2160 = 470.1 CSS px`。

**读不到键盘高度这件事本身也确认了**：壳曾尝试代页面读
`dumpsys window`，结果普通 app 身份直接返回 `Can't find service: window`
（该服务要求 DUMP 权限，root 也不便依赖）—— 所以只能量一次、按屏高比例算，
代码里把这段结论写进注释，免得以后重复试。

修复后实测：

   卡片底边 470.1 CSS px = 1293 屏幕px
   键盘顶边             = 1292 屏幕px
   误差 1px，截图确认 y=1290 页面底色 / y=1292 起键盘，中间无背景露出

六、已知取舍

- 键盘高度按**屏高比例**（1292/2160）算，本机微信输入法实测稳定（三次弹出一致）。
  换输入法若高度不同，调 KB_TOP_RATIO 一个常量即可。
- 抬升用 transform，不改 WebView 尺寸，点击命中与页面坐标系完全不受影响。
