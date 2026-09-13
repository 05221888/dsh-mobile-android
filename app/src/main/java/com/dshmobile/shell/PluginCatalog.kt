package com.dshmobile.shell

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class CatalogPlugin(
  val id: String,
  val name: String,
  val title: String,
  val desc: String,
  val assetDir: String,
  val scoped: Boolean,
  val defaultEnabled: Boolean,
  val safe: Boolean,
  val bootCritical: Boolean,
)

object PluginCatalog {
  private const val PREFS = "dsh_plugin_toggles"
  private const val CATALOG = "catalog/plugins.json"
  private const val SCHEMA = "schema"

  fun migrateDefaults(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val schema = prefs.getInt(SCHEMA, 0)
    if (schema >= 3) return
    val edit = prefs.edit()
    // v3：升级时一律回到 bootCritical-only。旧版本把 imagegen/memory-evolve 等
    // 重型插件默认打开，坏依赖一崩整棵 cordis 树倒，手机直接进不去聊天。
    // 用户可在「手机设置」里按需重新打开。
    for (plugin in list(context)) {
      edit.putBoolean(plugin.id, plugin.bootCritical)
    }
    edit.putInt(SCHEMA, 3).apply()
  }

  fun list(context: Context): List<CatalogPlugin> {
    return try {
      val raw = context.assets.open(CATALOG).bufferedReader().use { it.readText() }
      val arr = JSONArray(raw)
      (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        CatalogPlugin(
          id = o.getString("id"),
          name = o.getString("name"),
          title = o.optString("title", o.getString("name")),
          desc = o.optString("desc", ""),
          assetDir = o.getString("assetDir"),
          scoped = o.optBoolean("scoped", o.getString("name").contains("/")),
          defaultEnabled = o.optBoolean("defaultEnabled", false),
          safe = o.optBoolean("safe", false),
          bootCritical = o.optBoolean("bootCritical", false),
        )
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun isEnabled(context: Context, plugin: CatalogPlugin): Boolean {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return if (prefs.contains(plugin.id)) prefs.getBoolean(plugin.id, plugin.defaultEnabled)
    else plugin.defaultEnabled
  }

  fun setEnabled(context: Context, plugin: CatalogPlugin, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putBoolean(plugin.id, enabled).apply()
  }

  /** 一级兜底：引擎超时后关掉不安全的插件，保留 memory-evolve / leisure-zone 等 safe 项。 */
  fun enableOnlyBootCritical(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    for (plugin in list(context)) {
      prefs.putBoolean(plugin.id, plugin.safe)
    }
    prefs.apply()
  }

  /**
   * 二级兜底：只留 bootCritical 插件（记忆/休闲区/生图/问题导航全关）。
   *
   * 为什么需要：safe 是"平时可以常开"的标记，不是"绝不会拖垮引擎"的保证。
   * v0.15.x 的 imagegen 被标了 safe=true，但它依赖的 schemastery 丢了，
   * 一级兜底关不掉它 → 两次启动都超时 → 手机上直接进不去。二级兜底把
   * 所有非 bootCritical 项关掉，保证"能进聊天"这条底线。
   */
  fun enableMinimalSet(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    for (plugin in list(context)) {
      prefs.putBoolean(plugin.id, plugin.bootCritical)
    }
    prefs.apply()
  }

  /**
   * 四级兜底：目录内全部可选插件关闭（含 bootCritical）。
   * 只保留快照自带的 shell-termux / ui-responsive；若连它们也拖垮引擎，
   * EngineManager 会再修 cordis 工厂语义（重开 ui-layout）。
   */
  fun enableNone(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    for (plugin in list(context)) {
      prefs.putBoolean(plugin.id, false)
    }
    prefs.apply()
  }

  fun enabledNames(context: Context): Set<String> =
    list(context).filter { isEnabled(context, it) }.map { it.name }.toSet()

  fun applyToggles(context: Context, home: File) {
    val patch = File(home, "profiles/web/cordis.patch.yml")
    if (!patch.exists()) return
    var text = patch.readText()
    for (plugin in list(context)) {
      val enabled = isEnabled(context, plugin)
      val insert = insertBlock(plugin)
      val present = text.contains("name: '" + plugin.name + "'") ||
        text.contains("name: " + plugin.name) ||
        text.contains("name: '" + plugin.id + "'")
      if (enabled && !present) {
        if (text.isNotBlank() && !text.endsWith("\n")) text += "\n"
        text += insert
      } else if (!enabled && present) {
        text = stripInsert(text, plugin)
      }
    }
    patch.writeText(text)
  }

  private fun insertBlock(plugin: CatalogPlugin): String {
    return "- insert:\n    - id: '" + plugin.id + "'\n      name: '" + plugin.name + "'\n"
  }

  /**
   * 删除一个 insert 块：必须吞掉 `- insert:` 之后所有缩进更深的行（含 config 子树）。
   * 旧实现只删 3 行，配置键会变成孤儿 → js-yaml 解析失败 → cordis fail-loud → 引擎起不来。
   */
  private fun stripInsert(text: String, plugin: CatalogPlugin): String {
    val lines = text.replace("\r\n", "\n").split("\n")
    val out = ArrayList<String>(lines.size)
    var i = 0
    while (i < lines.size) {
      val line = lines[i]
      if (line.trim() == "- insert:" && i + 2 < lines.size) {
        val block = ArrayList<String>()
        var j = i
        // 整块：当前行 + 后续缩进更深或空行（直到下一项顶层）
        while (j < lines.size) {
          val cur = lines[j]
          if (j > i) {
            if (cur.isBlank()) {
              // 空行先记着；若后面还有缩进行则属于本块
              if (j + 1 < lines.size && (lines[j + 1].startsWith(" ") || lines[j + 1].startsWith("\t"))) {
                block.add(cur); j++; continue
              }
              break
            }
            val indented = cur.startsWith(" ") || cur.startsWith("\t")
            if (!indented) break
          }
          block.add(cur)
          j++
        }
        val joined = block.joinToString("\n")
        val hit = joined.contains(plugin.id) || joined.contains(plugin.name)
        if (hit && block.size >= 3) {
          i = j
          if (i < lines.size && lines[i].isBlank()) i++
          continue
        }
      }
      out.add(line)
      i++
    }
    return out.joinToString("\n").trimEnd() + "\n"
  }
}
