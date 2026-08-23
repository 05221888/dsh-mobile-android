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
    if (prefs.getInt(SCHEMA, 0) >= 2) return
    val edit = prefs.edit()
    for (plugin in list(context)) {
      if (!plugin.defaultEnabled) edit.putBoolean(plugin.id, false)
    }
    edit.putInt(SCHEMA, 2).apply()
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

  /** 引擎超时后关掉不安全插件，保留记忆/休闲区等 safe 项。 */
  fun enableOnlyBootCritical(context: Context) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
    for (plugin in list(context)) {
      prefs.putBoolean(plugin.id, plugin.safe)
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

  private fun stripInsert(text: String, plugin: CatalogPlugin): String {
    val lines = text.replace("\r\n", "\n").split("\n").toMutableList()
    val out = ArrayList<String>()
    var i = 0
    while (i < lines.size) {
      val line = lines[i]
      if (line.trim() == "- insert:" && i + 2 < lines.size) {
        val idLine = lines[i + 1]
        val nameLine = lines[i + 2]
        val hit = idLine.contains("'" + plugin.id + "'") ||
          nameLine.contains("'" + plugin.name + "'") ||
          nameLine.contains(plugin.name)
        if (hit) {
          i += 3
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
