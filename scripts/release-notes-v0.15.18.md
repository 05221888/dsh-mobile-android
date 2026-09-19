v0.15.18 输入区排版 + 键盘避让（打字时输入框跟着键盘上移）

用户反馈：① 发消息的聊天框被挤满了，可以学那个把权限变成胶囊、点开才出现；
② 打字时输入框要跟着键盘上移，否则看不到自己打的内容。

一、输入区排版（原来塞爆且重叠）
- 实测底部控制行：权限按钮 105px「Full access」+ 模型按钮 176px 挤在一行，
  两者重叠 64px，模型文字被压成 "DeepSee…"。
- 权限改成 30x30 胶囊（只留图标，点开才显示文字）—— 按用户建议。
- 行内分两块：tools（附件+权限，按内容宽）+ trailing（模型+其它+发送，吃剩余空间），
  每块 min-width:0，模型文字用 ellipsis 而不是硬截断。
- 结果：块间重叠 0、越界叶子元素 0、模型名 "DeepSeek-V4.1-Flash Max" 完整显示。

二、键盘避让（这一版的主要工作）
踩了很久才找到可行路径，记录清楚免得再走弯路：

本机（MIX 2S / MIUI / Android 10）系统层**拿不到键盘高度**：
- IME 窗口是独立 overlay，attrs 里 sim={adjust=pan}；App 窗口自己虽是 adjust=resize，
  但键盘弹出后 frame 恒为满屏 [0,0][1080,2160]；
- 因此 getWindowVisibleDisplayFrame 恒等于屏高；
- IME insets（setOnApplyWindowInsetsListener）一次都不回调；
- WebView 侧 innerHeight 恒 770、visualViewport 收不到任何 resize/scroll。
逐条试过并排除：去 setDecorFitsSystemWindows(false)、去 LAYOUT_STABLE/LAYOUT_FULLSCREEN、
改 LayoutParams.height + 布局监听、250ms 轮询、反射 InputMethodManager 隐藏 API、
反射 mCurRootView 取窗口几何、换输入法（微信输入法/搜狗）—— 都拿不到键盘高度。

最终方案：**由页面报告输入框焦点，壳据此收缩 WebView 布局高度**。
- 页面（compat-polyfills.js）：focusin/focusout 只认 textarea/input，
  经桥 window.androidBridge.setKeyboardVisible(true/false) 通知壳；
- 壳（MainActivity.applyKeyboardShrink）：收到 true 就把 WebView 高度设为
  屏高 − 42%（键盘典型高度），false 还原 MATCH_PARENT。

真机验证（MIX 2S / Android 10 / WebView 83）：
- 点输入框：innerHeight 770 → 447，输入框 y 667 → 344（升上来）
- 打字中：保持 447，输入框始终可见
- 失焦：innerHeight 还原 770，输入框回 667
- 键盘弹出时输入区：块间重叠 0、越界元素 0、模型名完整

注：42% 是按本机键盘实测取的（键盘约占屏高 39-45%）；换输入法若偏差大可再调。
