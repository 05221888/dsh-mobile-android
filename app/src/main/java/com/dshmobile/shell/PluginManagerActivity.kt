package com.dshmobile.shell

import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.activity.ComponentActivity

/** 手机里开关内置插件的管理页。改完后下次启动引擎生效。 */
class PluginManagerActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density
    val pad = (18 * density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, pad, pad, pad)
    }
    root.addView(TextView(this).apply {
      text = "插件管理"
      textSize = 22f
      setPadding(0, 0, 0, (8 * density).toInt())
    })
    root.addView(TextView(this).apply {
      text = "这里管的是电脑上那些插件要不要在手机里开。默认只开安全的。改完后回主页点「重试」重启引擎。"
      textSize = 13f
      setPadding(0, 0, 0, (14 * density).toInt())
    })
    for (plugin in PluginCatalog.list(this)) {
      val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
      box.addView(TextView(this).apply {
        text = plugin.title + if (plugin.safe) "" else "（实验）"
        textSize = 16f
      })
      box.addView(TextView(this).apply {
        text = plugin.desc
        textSize = 12f
      })
      val sw = Switch(this).apply {
        isChecked = PluginCatalog.isEnabled(this@PluginManagerActivity, plugin)
        text = if (isChecked) "已开启" else "已关闭"
        setOnCheckedChangeListener { _, on ->
          PluginCatalog.setEnabled(this@PluginManagerActivity, plugin, on)
          text = if (on) "已开启" else "已关闭"
        }
      }
      box.addView(sw)
      box.setPadding(0, 0, 0, (16 * density).toInt())
      root.addView(box)
    }
    root.addView(Button(this).apply {
      text = "返回"
      setOnClickListener { finish() }
    })
    val scroll = ScrollView(this)
    scroll.addView(root)
    setContentView(scroll)
  }
}
