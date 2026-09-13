package com.dshmobile.shell

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.content.FileProvider
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream
import java.io.BufferedInputStream
import java.io.File

/** 进聊天后的手机设置：Shizuku、插件、检查更新。 */
class PhoneSettingsActivity : ComponentActivity() {
  private lateinit var status: TextView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density
    val pad = (18 * density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, pad, pad, pad)
    }
    root.addView(TextView(this).apply {
      text = "手机设置"
      textSize = 22f
      setPadding(0, 0, 0, (10 * density).toInt())
    })
    status = TextView(this).apply {
      textSize = 13f
      setPadding(0, 0, 0, (14 * density).toInt())
    }
    root.addView(status)
    root.addView(Button(this).apply {
      text = "连接 Shizuku"
      setOnClickListener { startActivity(Intent(this@PhoneSettingsActivity, ShizukuSetupActivity::class.java)) }
    })
    root.addView(Button(this).apply {
      text = "测试桥接"
      setOnClickListener {
        Thread {
          val result = ShizukuManager.testBridge()
          runOnUiThread {
            status.text = result
            Toast.makeText(this@PhoneSettingsActivity, result, Toast.LENGTH_LONG).show()
          }
        }.start()
      }
    })
    root.addView(Button(this).apply {
      text = "插件管理"
      setOnClickListener { startActivity(Intent(this@PhoneSettingsActivity, PluginManagerActivity::class.java)) }
    })
    root.addView(Button(this).apply {
      text = "检查 App 更新"
      setOnClickListener { checkAppUpdate() }
    })
    root.addView(Button(this).apply {
      text = "检查运行时更新"
      setOnClickListener {
        UpdateManager(this@PhoneSettingsActivity).checkAndApply { msg ->
          runOnUiThread { status.text = msg }
        }
      }
    })
    root.addView(TextView(this).apply {
      text = "休闲区：打开侧栏会话列表，点「休闲区」标签。如果没有，先来插件管理打开休闲区，再回主页点重试。"
      textSize = 13f
      setPadding(0, (16 * density).toInt(), 0, 0)
    })
    root.addView(Button(this).apply {
      text = "返回"
      setOnClickListener { finish() }
    })
    val scroll = ScrollView(this)
    scroll.addView(root)
    setContentView(scroll)
    refresh()
  }

  override fun onResume() {
    super.onResume()
    refresh()
  }

  private fun refresh() {
    val shizuku = if (ShizukuShellExecutor.isAvailable()) "Shizuku 已连接" else "Shizuku 未连接"
    val plugins = PluginCatalog.list(this).filter { PluginCatalog.isEnabled(this, it) }.joinToString("、") { it.title }
    status.text = "$shizuku\n已开插件：$plugins"
  }

  private fun checkAppUpdate() {
    status.text = "正在检查 App 更新…"
    Thread {
      try {
        val mgr = UpdateManager(this)
        val update = mgr.checkApkUpdate()
        if (update == null) {
          runOnUiThread { status.text = "已是最新版" }
          return@Thread
        }
        runOnUiThread { status.text = "发现 " + update.versionName + "，正在下载…" }
        // 1) 下载。文件名按真实内容起名：url 是 .apk.xz → 用 .apk.xz。
        val compressed = File(filesDir, "dsh-update.apk.xz")
        mgr.downloadApk(update, compressed) { msg -> runOnUiThread { status.text = msg } }
        runOnUiThread { status.text = "下载完成，正在解压…" }

        // 2) 解压 xz → 真 APK。
        //    Gitee 附件上限 100MB，APK 128MB 必须 xz 压缩后再上传；
        //    Android 系统安装器只认 .apk，xz 流会被拒为「解析软件包失败 (33) PackageInfo is null」。
        val apk = File(filesDir, "dsh-update.apk")
        compressed.inputStream().use { raw ->
          BufferedInputStream(raw).use { buf ->
            XZCompressorInputStream(buf).use { xz ->
              apk.outputStream().use { out -> xz.copyTo(out) }
            }
          }
        }
        compressed.delete()

        // 3) 真 APK 给安装器。
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runOnUiThread {
          status.text = "解压完成，即将打开安装器（覆盖安装，不要卸载）"
          startActivity(intent)
        }
      } catch (t: Throwable) {
        runOnUiThread { status.text = "检查更新失败：" + (t.message ?: t.javaClass.simpleName) }
      }
    }.start()
  }
}
