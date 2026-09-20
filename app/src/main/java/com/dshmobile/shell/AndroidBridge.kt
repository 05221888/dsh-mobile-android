package com.dshmobile.shell

import android.net.Uri
import android.provider.DocumentsContract
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * JS bridge injected as window.androidBridge (protocol v1, see
 * docs/apk-shell-design.md). All methods are callable from the page; results
 * that arrive asynchronously are delivered back through
 * window.__dshBridge.onDirectoryPicked(callbackId, path) on the main thread.
 */
class AndroidBridge(
  private val onPickRequest: (callbackId: String) -> Unit,
  private val onKeepScreen: (enable: Boolean) -> Unit,
  private val onNotify: (title: String, text: String) -> Unit,
  private val onAllFilesAccessRequest: () -> Unit = {},
  private val onDebugLogsRequest: () -> Unit = {},
  private val onGetSystemDark: () -> Boolean = { false },
  private val onPickImageRequest: (callbackId: String) -> Unit = {},
  private val onSetTextZoomRequest: (percent: Int) -> Unit = {},
  private val onSetImmersiveRequest: (enable: Boolean) -> Unit = {},
  private val onCopyTextRequest: (text: String) -> Boolean = { false },
  private val pickToken: String? = null,
  private val onRestartEngine: () -> Unit = {},
  private val onReloadWebUI: () -> Unit = {},
  private val onOpenConsole: () -> Unit = {},
  private val onGetDevLogEnabled: () -> Boolean = { false },
  private val onSetDevLogEnabled: (Boolean) -> Unit = {},
  private val onOpenShizukuSetup: () -> Unit = {},
  private val onOpenPluginManager: () -> Unit = {},
  private val onCheckAppUpdate: () -> Unit = {},
  /**
   * v0.15.18 键盘避让：页面在输入框聚焦/失焦时通知壳，壳收缩/还原 WebView 高度。
   * 为什么走这条路：本机（MIUI / Android 10）系统层拿不到键盘高度 —— IME 是独立
   * overlay，App 窗口 frame 不随键盘变化，insets 不回调，页面也收不到 resize。
   * 唯一可靠信号就是「输入框是否聚焦」，而那只有页面知道。
   * @param shrink true = 键盘要弹了（收缩），false = 收起了（还原）
   */
  private val onKeyboardVisibility: (shrink: Boolean) -> Unit = {},
  /** v0.15.19：键盘当前是否真的在显示（页面判断不了，见 isKeyboardShown）。 */
  private val onIsKeyboardShown: () -> Boolean = { false },
) {

  /** 页面通知：软键盘将弹出 / 已收起。 */
  @JavascriptInterface
  fun setKeyboardVisible(visible: Boolean) {
    onKeyboardVisibility(visible)
  }

  /**
   * 键盘**当前是否真的在显示**（v0.15.19）。
   *
   * 页面自己判断不了这件事：返回键收键盘 / 切换输入法时，textarea 可能仍是
   * activeElement，页面无从得知键盘已经没了（真机上表现为 composer 一直悬在
   * 屏幕中间，用户再点底部的输入框位置会落空，要点第二次）。
   *
   * `InputMethodManager.isAcceptingText()` 经真机验证与键盘可见性完全一致
   * （键盘弹出 true → 返回键收起 false），且不受 DUMP 权限限制 ——
   * `dumpsys input_method` / `dumpsys window` 两条路普通 app 都读不到。
   */
  @JavascriptInterface
  fun isKeyboardShown(): Boolean = onIsKeyboardShown()

  @JavascriptInterface
  fun version(): String = "1.0"

  /** 系统深色状态同步查询（H1：首帧主题桥启动时拉取真实 uiMode，
   *  绕过厂商 WebView matchMedia 卡 light 的问题）。 */
  @JavascriptInterface
  fun getSystemDark(): Boolean = onGetSystemDark()

  @JavascriptInterface
  fun checkEngine(): String = EngineProbe.check().toString()

  @JavascriptInterface
  fun keepScreenOn(enable: Boolean) {
    onKeepScreen(enable)
  }

  @JavascriptInterface
  fun showNotification(title: String, text: String) {
    onNotify(title, text)
  }

  @JavascriptInterface
  fun pickDirectory(callbackId: String) {
    onPickRequest(callbackId)
  }

  @JavascriptInterface
  fun pickImage(callbackId: String) {
    onPickImageRequest(callbackId)
  }

  /** 设置 WebView 字体缩放（textZoom，50–200）；设置 → 通用设置 滑块调用。 */
  @JavascriptInterface
  fun setTextZoom(percent: Int) {
    onSetTextZoomRequest(percent)
  }

  /** 沉浸式状态栏开关（true=状态栏常态收起）；设置 → 通用设置 调用。 */
  @JavascriptInterface
  fun setImmersiveMode(enable: Boolean) {
    onSetImmersiveRequest(enable)
  }

  /**
   * 原生剪贴板写入（WebView 的 navigator.clipboard.writeText 在 Android 上
   * 恒被拒 NotAllowedError: Write permission denied，页面 writeClipboard
   * 失败后回退调用本桥）。返回是否写入成功。
   */
  @JavascriptInterface
  fun copyText(text: String): Boolean = onCopyTextRequest(text)

  /** 调试日志导出：引擎日志 + 环境信息打包 zip（走会话导出同款下载/弹窗链路）。 */
  @JavascriptInterface
  fun downloadDebugLogs() {
    onDebugLogsRequest()
  }

  /** True when the app holds All Files Access (external workspace requirement). */
  @JavascriptInterface
  fun hasAllFilesAccess(): Boolean {
    // isExternalStorageManager 仅 API 30+ 存在；低版本无该权限模型。
    if (android.os.Build.VERSION.SDK_INT < 30) return false
    return android.os.Environment.isExternalStorageManager()
  }

  /** Open the system screen granting All Files Access (special permission). */
  @JavascriptInterface
  fun requestAllFilesAccess() {
    onAllFilesAccessRequest()
  }

  /** 目录选择桥的一次性会话 token（引擎侧 pick 端点校验；null = 未启用）。 */
  @JavascriptInterface
  fun getPickToken(): String? = pickToken

  /** 重启引擎服务进程：kill 引擎进程，EngineService 看门狗自动拉起。 */
  @JavascriptInterface
  fun restartEngine() {
    onRestartEngine()
  }

  /** 刷新 Web UI（重载当前引擎页面，issue apk#29 需求 1）。 */
  @JavascriptInterface
  fun reloadWebUI() {
    onReloadWebUI()
  }

  /** 打开内置控制台（快照 bash 交互终端，引擎未运行时也可排查）。 */
  @JavascriptInterface
  fun openConsole() {
    onOpenConsole()
  }

  /** 开发者调试日志开关状态（默认关；SharedPreferences 持久化）。 */
  @JavascriptInterface
  fun getDevLogEnabled(): Boolean = onGetDevLogEnabled()

  /** 设置开发者调试日志开关；开启后按天写入 dshdata/log/。 */
  @JavascriptInterface
  fun setDevLogEnabled(enabled: Boolean) {
    onSetDevLogEnabled(enabled)
  }

  /** Shizuku 状态：可用性 + 版本摘要（供设置页展示授权进度）。 */
  @JavascriptInterface
  fun shizukuStatus(): String {
    return try {
      if (ShizukuShellExecutor.isAvailable()) {
        "{\"available\":true,\"version\":\"" + rikka.shizuku.Shizuku.getVersion() + "\"}"
      } else {
        "{\"available\":false}"
      }
    } catch (_: Exception) {
      "{\"available\":false}"
    }
  }

  /** 尝试打开 Shizuku 授权入口：已装 App 则跳转，未装则跳 Play/官网。 */
  @JavascriptInterface
  fun openShizukuSetup() {
    onOpenShizukuSetup()
  }

  @JavascriptInterface
  fun openPluginManager() {
    onOpenPluginManager()
  }

  @JavascriptInterface
  fun checkAppUpdate() {
    onCheckAppUpdate()
  }

  companion object {
    /**
     * Map an ACTION_OPEN_DOCUMENT_TREE result onto a Termux-visible real path
     * when possible: "primary:rel/path" -> /storage/emulated/0/rel/path.
     * Non-primary volumes fall back to the raw content:// tree URI (the page
     * can still use it as an opaque handle).
     * @param uri the tree URI from the system picker.
     * @returns the mapped real path or the original URI string.
     */
    fun resolvePickedPath(uri: Uri): String {
      return try {
        val docId = DocumentsContract.getTreeDocumentId(uri)
        val idx = docId.indexOf(':')
        val volume = if (idx > 0) docId.substring(0, idx) else ""
        val rel = if (idx > 0) docId.substring(idx + 1) else docId
        // M5：路径清洗——拒绝 `..` 段/绝对路径（防越界），空 rel 拒绝。
        if (rel.isEmpty() || rel.split("/").any { it == ".." } || rel.startsWith("/")) {
          return uri.toString()
        }
        if (volume == "primary") "/storage/emulated/0/$rel" else uri.toString()
      } catch (_: Exception) {
        uri.toString()
      }
    }
  }
}

/** JSON string literal escaping for evaluateJavascript payloads. */
internal fun jsString(value: String): String = JSONObject.quote(value)