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

   点输入框 #1        IME=true
   打字               文字正常显示在输入框
   点消息区收键盘      IME=false，位置还原（composer y 355 → 632）
   再点输入框 #2      IME=true   ← v0.15.18 这里必定失败
   第三次              IME=true
   连点 5 次          5/5 成功

键盘弹出时几何（CSS px / 屏幕 px）：
- composerStack y 632 → 355，视口 innerHeight 保持 770（不再收缩）
- 输入框底部 1150px，估算键盘顶边 1355px → 输入内容完整可见
