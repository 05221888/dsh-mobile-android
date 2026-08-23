package com.dshmobile.shell

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import rikka.shizuku.Shizuku

/**
 * 进入 App 后固定的 Shizuku 连接教导页。
 * 对照官方 dsh-phone：先确认 binder，再主动 requestPermission 弹窗，而不是只跳到 Shizuku App。
 */
class ShizukuSetupActivity : ComponentActivity() {

  private lateinit var status: TextView
  private lateinit var log: TextView

  private val permissionListener = Shizuku.OnRequestPermissionResultListener { _, _ ->
    refresh()
    append("收到授权结果，正在刷新状态…")
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density
    val pad = (20 * density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, pad, pad, pad)
    }
    val title = TextView(this).apply {
      text = "连接 Shizuku"
      textSize = 22f
      setPadding(0, 0, 0, (10 * density).toInt())
    }
    status = TextView(this).apply {
      textSize = 15f
      setPadding(0, 0, 0, (12 * density).toInt())
    }
    val guide = TextView(this).apply {
      text = GUIDE
      textSize = 14f
      setPadding(0, 0, 0, (16 * density).toInt())
    }
    val connect = Button(this).apply {
      text = "立即连接 / 授权"
      setOnClickListener { connectNow() }
    }
    val openApp = Button(this).apply {
      text = "打开 Shizuku App"
      setOnClickListener { openShizukuApp() }
    }
    val test = Button(this).apply {
      text = "测试桥接"
      setOnClickListener {
        Thread {
          val result = ShizukuManager.testBridge()
          runOnUiThread {
            append(result)
            refresh()
          }
        }.start()
      }
    }
    val download = Button(this).apply {
      text = "去下载 Shizuku"
      setOnClickListener {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://shizuku.rikka.app/zh-hans/download.html")))
      }
    }
    log = TextView(this).apply {
      textSize = 12f
      setPadding(0, (16 * density).toInt(), 0, 0)
    }
    root.addView(title)
    root.addView(status)
    root.addView(guide)
    root.addView(connect)
    root.addView(openApp)
    root.addView(test)
    root.addView(download)
    root.addView(log)
    val scroll = ScrollView(this)
    scroll.addView(root)
    setContentView(scroll)
    Shizuku.addRequestPermissionResultListener(permissionListener)
    refresh()
    ShizukuManager.ensureBridgeRunning(this)
  }

  override fun onResume() {
    super.onResume()
    refresh()
    ShizukuManager.ensureBridgeRunning(this)
  }

  override fun onDestroy() {
    Shizuku.removeRequestPermissionResultListener(permissionListener)
    super.onDestroy()
  }

  private fun refresh() {
    val installed = packageManager.getLaunchIntentForPackage(SHIZUKU_PKG) != null
    val binder = ShizukuShellExecutor.binderReady()
    val granted = ShizukuShellExecutor.hasPermission()
    status.text = when {
      !installed -> "当前：未安装 Shizuku"
      !binder -> "当前：已安装，但 Shizuku 服务未启动（去 App 里点启动）"
      !granted -> "当前：服务已启动，但本 App 还未授权"
      else -> "当前：已连接并授权，可以操控手机"
    }
  }

  private fun connectNow() {
    if (packageManager.getLaunchIntentForPackage(SHIZUKU_PKG) == null) {
      append("还没装 Shizuku，先去下载安装。")
      startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://shizuku.rikka.app/zh-hans/download.html")))
      return
    }
    if (!ShizukuShellExecutor.binderReady()) {
      append("服务还没起来。先打开 Shizuku App，完成无线调试/配对后点启动。")
      openShizukuApp()
      return
    }
    if (ShizukuShellExecutor.hasPermission()) {
      append("已经授权。正在启动本地桥…")
      ShizukuManager.ensureBridgeRunning(this)
      refresh()
      return
    }
    append("正在弹出 Shizuku 授权窗口，请点允许。")
    try {
      Shizuku.requestPermission(1001)
    } catch (t: Throwable) {
      append("弹窗失败：" + (t.message ?: t.javaClass.simpleName) + "。改为打开 Shizuku App 手动授权。")
      openShizukuApp()
    }
  }

  private fun openShizukuApp() {
    val intent = packageManager.getLaunchIntentForPackage(SHIZUKU_PKG)
    if (intent != null) startActivity(intent)
    else startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://shizuku.rikka.app/zh-hans/download.html")))
  }

  private fun append(line: String) {
    log.text = (log.text?.toString() ?: "") + "\n• " + line
  }

  companion object {
    private const val SHIZUKU_PKG = "moe.shizuku.privileged.api"
    private const val GUIDE =
      "按这 4 步就能连上（和 GitHub 上 dsh-phone 同一套）：\n" +
        "1. 安装 Shizuku（没装就点下面“去下载”）\n" +
        "2. 打开 Shizuku → 用无线调试配对，或电脑 adb 启动\n" +
        "3. 回到本页点“立即连接 / 授权”，在弹窗里允许\n" +
        "4. 点“测试桥接”，看到 echo ok 就成功了\n\n" +
        "连上后不用每次重装 App。重启手机后只要再打开一次 Shizuku，再回本页点连接即可。"
  }
}
