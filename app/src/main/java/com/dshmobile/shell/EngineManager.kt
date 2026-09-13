package com.dshmobile.shell

import android.content.Context
import android.media.MediaScannerConnection
import android.os.Environment
import android.util.Log
import java.io.File
import java.nio.file.Files
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream

/**
 * Owns the embedded Termux environment snapshot: first-launch extraction into
 * filesDir/usr and the dsh engine process lifecycle (PATH/LD_LIBRARY_PATH/HOME
 * injected explicitly — the snapshot is self-sufficient, no Termux app needed).
 */
class EngineManager(private val context: Context, private val pickToken: String? = null) {

  val usrDir = File(context.filesDir, "usr")
  val homeDir = File(context.filesDir, "home")

  /**
   * 公共导出仓库：/storage/emulated/0/Documents/dshdata。
   * 仅存放用户主动导出的 session zip（exports/）与 .nomedia 防扫描标记；
   * 运行时用户数据全部回私有 app data（files/home/.dsh）。
   */
  val dshDataDir: File
    get() {
      val publicDocs = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
        ?: File(context.filesDir, "dshdata-fallback")
      return File(publicDocs, "dshdata")
    }
  private val nodeBin = File(usrDir, "bin/node")
  private val dshBin = File(usrDir, "lib/node_modules/@deepseek-ai/dsh/lib/bin.js")
  private var engineProcess: Process? = null

  val engineReady: Boolean get() = nodeBin.exists()

  /** 内嵌快照指纹（assets/snapshot.sha256，由 build-release.ps1 生成）。 */
  private fun bundledFingerprint(): String = try {
    context.assets.open("snapshot.sha256").bufferedReader().use { it.readText().trim() }
  } catch (_: Exception) {
    ""
  }

  private fun fingerprintFile(): File = File(context.filesDir, ".snapshot-fingerprint")

  /**
   * 快照是否已解压且与内嵌版本一致：node 存在 + 指纹匹配。
   * 升级安装（v0.10.5→v0.10.6 教训）：engineReady 只查 node 存在，
   * 升级后快照不重解压 → 旧插件继续跑（注入守卫 bug 等修复不生效）。
   */
  fun snapshotFresh(): Boolean {
    if (!nodeBin.exists()) return false
    // 先体检：外来/半成品运行时（如 home/ds/tmp-upgrade 那棵）会让引擎永远起不来，
    // 这时候**不能**再信"在线更新优先"，必须重解压内嵌快照把它换掉。
    val problems = runtimeProblems()
    if (problems.isNotEmpty()) {
      Log.w(TAG, "runtime problems -> force re-extract: " + problems.joinToString("; "))
      dropForeignRuntime()
      return false
    }
    // 在线更新运行时优先：在线指纹存在即视为最新（不重解压内嵌快照，避免把
    // 在线更新覆盖回出厂）。运行时补丁每次启动都会重打，在线运行时同样受益。
    if (File(context.filesDir, ".online-fingerprint").exists()) return true
    val fp = bundledFingerprint()
    if (fp.isEmpty()) return true // 无指纹文件（旧构建）不强制重解压
    return fingerprintFile().exists() && fingerprintFile().readText().trim() == fp
  }

  /**
   * 升级/快照变化：备份用户数据 → 全量重解压内嵌快照 → 恢复用户数据 → 写指纹。
   * 快照剥离了 sessions/storages/attachments/凭据/settings（make-snapshot.sh），
   * 直接重解压会"丢失"这些私有数据，必须先备份后恢复；profiles 出厂配置
   * （cordis*.yml/node_modules）以快照为准（手动 patch 需在新版基础上重打）。
   * 任何失败：恢复备份数据，保留旧运行时（下次启动重试）。
   */
  fun refreshSnapshot(onProgress: (Long, Long) -> Unit): Boolean {
    val backup = File(context.filesDir, ".dsh-backup")
    val dsh = File(homeDir, ".dsh")
    try {
      if (dsh.exists()) {
        backup.deleteRecursively()
        dsh.copyRecursively(backup)
      }
      val ok = extractSnapshot(onProgress)
      if (!ok) {
        restoreUserData(backup, dsh)
        Log.e(TAG, "snapshot refresh: extract failed, kept old runtime")
        return false
      }
      restoreUserData(backup, dsh)
      backup.deleteRecursively()
      fingerprintFile().writeText(bundledFingerprint())
      Log.i(TAG, "snapshot refreshed (fingerprint " + bundledFingerprint().take(12) + ")")
      return true
    } catch (t: Throwable) {
      restoreUserData(backup, dsh)
      Log.e(TAG, "snapshot refresh failed; kept old runtime", t)
      return false
    }
  }

  /** 恢复快照剥离的用户数据目录/文件（从备份拷贝回私有 .dsh）。 */
  private fun restoreUserData(backup: File, dsh: File) {
    if (!backup.exists()) return
    for (name in listOf(
      "sessions", "storages", "attachments",
      ".credentials.yaml", "settings.yaml", ".anonymous-user-id", ".private-layout",
    )) {
      val src = File(backup, name)
      if (!src.exists()) continue
      val dst = File(dsh, name)
      if (dst.exists()) dst.deleteRecursively()
      src.copyRecursively(dst)
    }
  }

  /** 进程级启动守卫（MainActivity 与 EngineService 各自 new EngineManager，
   *  实例字段互不可见——双启动竞态必须用 companion 级 CAS）。 */
  private val starting: Boolean
    get() = STARTING.get()

  /**
   * Extract the bundled snapshot archive into filesDir. Runs on any thread;
   * callers own the progress UI.
   * @param onProgress bytesDone, bytesTotal.
   * @returns true on success.
   */
  fun extractSnapshot(onProgress: (Long, Long) -> Unit): Boolean {
    return try {
      val fd = context.assets.openFd("snapshot.tar.xz")
      SnapshotExtractor.extract(context.assets.open("snapshot.tar.xz"), fd.length, usrDir.parentFile, onProgress)
      homeDir.mkdirs()
      true
    } catch (t: Throwable) {
      Log.e(TAG, "snapshot extract failed", t)
      false
    }
  }

  /**
   * 确保私有 DSH_HOME 数据布局就绪（幂等，后台线程调用）。
   *
   * v0.10.5 起运行时数据全部回私有 app data；Documents/dshdata 只保留为
   * 用户主动导出仓库（exports/ + .nomedia）。本方法负责：
   *  - 首次/干净安装：直接建立私有 .dsh 布局与公共导出仓库；
   *  - 检测到 v0.10.4 及更早的公共迁移布局（.migrated-from 或私有 symlink）：
   *    执行反向迁移，把 sessions/storages/attachments/profiles/settings.yaml
   *    复制回私有实体，并清理公共旧数据；
   *  - 任何失败都保留公共数据，引擎仍以私有 DSH_HOME 启动，下次重试。
   *
   * DSH_HOME 永远保持私有域：profiles/node_modules 的 flat-fallback symlink
   * 机制依赖 app 私有域（公共 FUSE 禁 symlink），绝不能整体迁移 DSH_HOME。
   */
  fun ensurePrivateDshData(): File {
    val dshData = dshDataDir
    val privateDsh = File(homeDir, ".dsh")
    privateDsh.mkdirs()
    val privateMarker = File(privateDsh, ".private-layout")
    if (privateMarker.exists()) {
      ensurePublicExportRepo(dshData)
      return privateDsh
    }
    if (isLegacyPublicLayout(dshData, privateDsh)) {
      try {
        reverseMigrate(dshData, privateDsh)
        privateMarker.writeText("private")
        ensurePublicExportRepo(dshData)
        Log.i(TAG, "dshdata reverse migration done -> " + privateDsh.absolutePath)
      } catch (t: Throwable) {
        // 迁移失败不阻断启动：DSH_HOME 仍私有，引擎可用，下次再试。
        Log.e(TAG, "dshdata reverse migration failed; keeping public data", t)
      }
    } else {
      // 干净安装或已经是私有布局：直接标记，无需迁移。
      try {
        privateMarker.writeText("private")
      } catch (t: Throwable) {
        Log.w(TAG, "private layout marker write failed", t)
      }
      ensurePublicExportRepo(dshData)
    }
    return privateDsh
  }

  /** 识别 v0.10.4 及更早的公共迁移布局。 */
  private fun isLegacyPublicLayout(dshData: File, privateDsh: File): Boolean {
    if (File(dshData, ".migrated-from").exists()) return true
    for (name in listOf("sessions", "storages", "attachments")) {
      if (isSymlink(File(privateDsh, name))) return true
    }
    for (profile in listOf("web", "headless")) {
      for (name in listOf("cordis.yml", "cordis.patch.yml")) {
        if (isSymlink(File(privateDsh, "profiles/$profile/$name"))) return true
      }
    }
    return false
  }

  /** 反向迁移：公共数据复制回私有实体，公共旧目录/文件清理。 */
  private fun reverseMigrate(dshData: File, privateDsh: File) {
    for (name in listOf("sessions", "storages", "attachments")) {
      reverseMigrateDir(File(privateDsh, name), File(dshData, name))
    }
    for (profile in listOf("web", "headless")) {
      for (name in listOf("cordis.yml", "cordis.patch.yml")) {
        reverseMigrateFile(
          File(privateDsh, "profiles/$profile/$name"),
          File(dshData, "profiles/$profile/$name"),
        )
      }
    }
    reverseMigrateFile(File(privateDsh, "settings.yaml"), File(dshData, "settings.yaml"))

    // 清理旧公共数据（冲突时已改名 *.public-backup，不会被动到）。
    val removedPaths = mutableListOf<String>()
    for (name in listOf("sessions", "storages", "attachments", "profiles", "settings.yaml", ".migrated-from")) {
      val f = File(dshData, name)
      if (f.exists()) {
        removedPaths += f.absolutePath
        if (!f.deleteRecursively()) {
          throw java.io.IOException("failed to delete public path " + f.absolutePath)
        }
      }
    }
    // 通知 MediaScanner 旧公共子目录已删除，清掉相册已索引的假视频条目。
    if (removedPaths.isNotEmpty()) {
      try {
        MediaScannerConnection.scanFile(context, removedPaths.toTypedArray(), null, null)
      } catch (t: Throwable) {
        Log.w(TAG, "media scan cleanup failed", t)
      }
    }
  }

  /** 目录级反向迁移：删私有 symlink，公共实体复制回私有并校验后删公共源。 */
  private fun reverseMigrateDir(privateDir: File, publicDir: File) {
    if (isSymlink(privateDir)) {
      Files.delete(privateDir.toPath())
    }
    if (!publicDir.isDirectory) return
    if (privateDir.isDirectory) {
      if (privateDir.listFiles()?.isNotEmpty() == true) {
        // 冲突：私有实体优先，公共副本保留待核。
        val backup = uniqueBackup(publicDir)
        if (!publicDir.renameTo(backup)) {
          throw java.io.IOException("failed to backup public dir " + publicDir.absolutePath)
        }
        Log.w(TAG, "private " + privateDir.absolutePath + " exists; public kept as " + backup.absolutePath)
        return
      }
      privateDir.deleteRecursively()
    }
    privateDir.parentFile?.mkdirs()
    copyTreeVerified(publicDir, privateDir)
    if (!publicDir.deleteRecursively()) {
      throw java.io.IOException("failed to delete public source " + publicDir.absolutePath)
    }
  }

  /** 文件级反向迁移：删私有 symlink，公共文件复制回私有后删公共源。 */
  private fun reverseMigrateFile(privateFile: File, publicFile: File) {
    if (isSymlink(privateFile)) {
      Files.delete(privateFile.toPath())
    }
    if (!publicFile.isFile) return
    if (privateFile.exists()) {
      if (privateFile.length() > 0) {
        // 公共文件是迁移后的活动副本（settings/profiles），以公共为准；
        // 私有旧实体备份保留，不静默删除。
        val backup = uniquePrivateBackup(privateFile)
        if (!privateFile.renameTo(backup)) {
          throw java.io.IOException("failed to backup private file " + privateFile.absolutePath)
        }
        Log.w(TAG, "private file backed up as " + backup.absolutePath)
      } else {
        privateFile.delete()
      }
    }
    privateFile.parentFile?.mkdirs()
    publicFile.copyTo(privateFile, overwrite = true)
    if (privateFile.length() != publicFile.length()) {
      throw java.io.IOException("copy verification failed for " + publicFile.absolutePath)
    }
    if (!publicFile.delete()) {
      throw java.io.IOException("failed to delete public source " + publicFile.absolutePath)
    }
  }

  /** 确保公共导出仓库存在：根目录 + .nomedia + exports/。 */
  private fun ensurePublicExportRepo(dshData: File) {
    try {
      dshData.mkdirs()
      File(dshData, ".nomedia").writeText("")
      File(dshData, "exports").mkdirs()
    } catch (t: Throwable) {
      Log.w(TAG, "public export repo setup failed", t)
    }
  }

  private fun isSymlink(file: File): Boolean = Files.isSymbolicLink(file.toPath())

  private fun uniqueBackup(publicFile: File): File {
    var candidate = File(publicFile.parentFile, publicFile.name + ".public-backup")
    var i = 1
    while (candidate.exists()) {
      candidate = File(publicFile.parentFile, publicFile.name + ".public-backup-" + i)
      i++
    }
    return candidate
  }

  private fun uniquePrivateBackup(privateFile: File): File {
    var candidate = File(privateFile.parentFile, privateFile.name + ".private-backup")
    var i = 1
    while (candidate.exists()) {
      candidate = File(privateFile.parentFile, privateFile.name + ".private-backup-" + i)
      i++
    }
    return candidate
  }

  /** 递归拷贝目录树，并校验文件数与总大小。 */
  private fun copyTreeVerified(src: File, dst: File) {
    dst.mkdirs()
    src.listFiles()?.forEach { f ->
      val target = File(dst, f.name)
      if (f.isDirectory) {
        copyTreeVerified(f, target)
      } else {
        f.copyTo(target, overwrite = true)
      }
    }
    val srcFiles = src.walkBottomUp().filter { it.isFile }.toList()
    val dstFiles = dst.walkBottomUp().filter { it.isFile }.toList()
    val srcSize = srcFiles.sumOf { it.length() }
    val dstSize = dstFiles.sumOf { it.length() }
    if (srcFiles.size != dstFiles.size || srcSize != dstSize) {
      throw java.io.IOException("copy verification failed for " + src.absolutePath)
    }
  }

  /**
   * 运行时补丁：把 assets/patched 里的修复文件覆盖/追加到快照对应位置（幂等）。
   * 覆盖的修复：
   *  - client.js：图片按钮（bridge 版）+ onImagePicked 处理（华为 WebView 不触发 input change）
   *  - attachment-local：Android link(2) 被 sepolicy 拦截 → copyFile 回退 + EACCES 容忍
   *  - llm-deepseek：视觉桥接（上传图片 → Qwen-VL 文字描述再喂 DeepSeek）
   *  - web-frontend index.html：AbortSignal.any polyfill（华为 WebView Chromium 114 缺失）
   *  - vision-mcp server.mjs + web profile cordis.patch.yml：读图 MCP 挂载
   * 每项以目标文件内是否存在标记串判断是否已应用（快照刷新/重解压后自动重打）。
   */
  private fun applyRuntimePatches() {
    val dshPkgs = File(usrDir, "lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai")
    val webDist = File(dshPkgs, "dsh-web-frontend/dist")
    val home = File(homeDir, ".dsh")
    applyAssetPatch("patched/client-ui-conversation-client.js",
      File(dshPkgs, "dsh-client-ui-conversation/lib/client.js"), "onImagePicked")
    applyAssetPatch("patched/settings-general-client.js",
      File(dshPkgs, "dsh-client-ui-settings-general/lib/client.js"), "dsh-mobile-textzoom")
    applyAssetPatch("patched/primitives-index.js",
      File(dshPkgs, "dsh-client-ui-primitives/lib/index.js"), "dsh-mobile-clip-fallback")
    applyAssetPatch("patched/attachment-local-index.js",
      File(dshPkgs, "dsh-attachment-local/lib/index.js"), "COPYFILE_EXCL")
    applyAssetPatch("patched/llm-deepseek-index.js",
      File(dshPkgs, "dsh-llm-deepseek/lib/index.js"), "describeImage")
    applyAssetPatch("patched/web-frontend-index.html",
      File(webDist, "index.html"), "dsh-mobile-clip-fallback-web")
    applyAssetPatch("patched/dsh-client-modules-index.js",
      File(dshPkgs, "dsh-client-modules/lib/index.js"), "dsh-mobile-bundle-hardening")
    applyAssetPatch("patched/vision-mcp-server.mjs",
      File(homeDir, "vision-mcp/server.mjs"), "Qwen-VL")
    // 每次启动先把 web cordis 重置成出厂工厂件，再按开关写入。
    // 连续早夭 ≥2 次 → 换 ultra-safe 工厂件（去掉 shell-termux / ui-responsive）。
    try {
      val assetName = if (earlyCrashCount >= 2) {
        "patched/factory-web-cordis.safe.patch.yml"
      } else {
        "patched/factory-web-cordis.patch.yml"
      }
      val factory = context.assets.open(assetName).bufferedReader().use { it.readText() }
      val patchFile = File(home, "profiles/web/cordis.patch.yml")
      patchFile.parentFile?.mkdirs()
      patchFile.writeText(factory)
      Log.w(TAG, "cordis factory reset: $assetName (earlyCrash=$earlyCrashCount)")
    } catch (t: Throwable) {
      Log.e(TAG, "factory cordis reset failed", t)
    }
    // 视觉 MCP 只有配了 key 才挂：空 key 起 stdio 子进程失败会拖垮 cordis fail-loud。
    val hasVisionKey = File(context.filesDir, "dashscope-key.txt").takeIf { it.exists() }
      ?.readText()?.trim()?.isNotEmpty() == true
    if (hasVisionKey) {
      applyAssetPatchAppend("patched/cordis.patch.yml",
        File(home, "profiles/web/cordis.patch.yml"), "mcp-vision")
    }
    applyAssetPatchAppend("patched/cordis-pwsh-fix.yml",
      File(home, "profiles/web/cordis.patch.yml"), "dsh-mobile-pwsh-fix")
    ensureFactoryProfile(home)
    PluginCatalog.migrateDefaults(context)
    // 快照里 profile 的 @deepseek-ai 链接指向别的 App（Termux）私有目录，链不到就整体
    // 解析不到核心包（截图第一条报错）。先重指到本 App 引擎树，再谈别的。
    repairForeignProfileLinks(home)
    seedDesktopMemories()
    seedLeisureBook()
    val plugins = PluginCatalog.list(context)
    for (plugin in plugins) {
      installMobilePlugin(plugin.assetDir, plugin.name, home, plugin.scoped)
    }
    // 依赖预检必须在 applyToggles 之前：被判"依赖缺失"的插件要在这里关掉，
    // applyToggles 才会顺势把它从 cordis.patch.yml 里摘掉。
    val autoDisabled = ensurePluginDeps(home, plugins)
    PluginCatalog.applyToggles(context, home)
    // 上次崩过：从 engine.log 原文读出到底哪条 entry 挂了，隔离后重试（收敛，不靠猜）。
    val quarantined = applyQuarantine(home)
    // patch 引用但引擎树里没有的插件补成引擎可见（loader 解析基准是引擎树）。
    val linked = linkEngineVisiblePlugins(home)
    writeStartupReport(autoDisabled, quarantined, linked)
  }

  /**
   * cordis 工厂语义纠正（参考 kelai141 FactoryProfilePatch）。
   *
   * 快照出厂把 `ui-layout` 标成 disabled、改挂 ui-responsive。ui-responsive
   * 缺失或坏掉时整棵布局树不 activate → 会话区空白 =「装完用不了」。
   * 规则：
   *  - ui-responsive 包健在 → 保留 disabled ui-layout（移动端布局）；
   *  - ui-responsive 不在 → 强制 re-enable ui-layout，否则必黑屏。
   */
  private fun ensureFactoryProfile(home: File) {
    try {
      val patch = File(home, "profiles/web/cordis.patch.yml")
      if (!patch.isFile) return
      var text = patch.readText().replace("\r\n", "\n")
      val webNm = File(home, "profiles/web/node_modules")
      val topNm = File(home, "profiles/node_modules")
      val responsiveOk = File(webNm, "@dsh-android/dsh-client-ui-responsive/package.json").isFile ||
        File(topNm, "@dsh-android/dsh-client-ui-responsive/package.json").isFile
      if (!responsiveOk) {
        // 重开布局中枢：任何 disabled: true 的 ui-layout 行改回 false / 补写。
        val lines = text.split("\n").toMutableList()
        var i = 0
        var found = false
        while (i < lines.size) {
          if (lines[i].trim().startsWith("id: ui-layout") ||
            lines[i].trim().startsWith("- id: ui-layout")
          ) {
            found = true
            var j = i + 1
            var replaced = false
            while (j < lines.size && lines[j].isNotBlank() && !lines[j].trim().startsWith("- ")) {
              if (lines[j].trim().startsWith("disabled:")) {
                lines[j] = lines[j].replace("disabled: true", "disabled: false")
                replaced = true
              }
              j++
            }
            if (!replaced) lines.add(j, "  disabled: false")
            break
          }
          i++
        }
        if (!found) lines.add("- id: ui-layout\n  disabled: false")
        text = lines.joinToString("\n")
        Log.w(TAG, "ui-responsive missing; re-enabled ui-layout")
      }
      if (!text.contains("dsh-mobile-pwsh-fix") && !text.contains("pwsh-sandbox")) {
        // pwsh 禁用仍由 cordis-pwsh-fix 追加，这里不重复。
      }
      patch.writeText(if (text.endsWith("\n")) text else text + "\n")
    } catch (t: Throwable) {
      Log.e(TAG, "ensureFactoryProfile failed", t)
    }
  }

  /**
   * 插件依赖预检 —— 引擎启动前的最后一道闸。
   *
   * 把每个**已启用**内置插件 entry（package.json 的 main，默认 lib/index.js）里出现的
   * 裸 specifier 逐个验证：
   *   1) 插件自己的 node_modules / profiles[/web] node_modules 里有 → 放行；
   *   2) 只有 dsh 自带的 node_modules 里有（schemastery / ws 这类顶层包）→ 建 symlink 借用；
   *   3) 哪里都没有 → 这插件一加载就 ERR_MODULE_NOT_FOUND，而 cordis 是 fail-loud
   *      （单插件挂掉整棵 cordis 树倒）→ **直接关掉它**：宁可少个功能，也不能进不去聊天。
   *
   * v0.15.x 事故复盘：imagegen 1.5.1 的 lib/index.js 第 3 行 `import z from "schemastery"`，
   * 随包 node_modules 在升级时丢了、快照里也没有裸 schemastery ⇒ 引擎两次启动超时。
   * @return 被自动关掉的插件名（写进启动报告）。
   */
  private fun ensurePluginDeps(home: File, plugins: List<CatalogPlugin>): List<String> {
    val disabled = mutableListOf<String>()
    try {
      val webNm = File(home, "profiles/web/node_modules")
      val topNm = File(home, "profiles/node_modules")
      val dshNm = File(usrDir, "lib/node_modules/@deepseek-ai/dsh/node_modules")
      for (plugin in plugins) {
        if (!PluginCatalog.isEnabled(context, plugin)) continue
        val dir = pluginDir(home, plugin)
        if (!dir.isDirectory) continue
        val entry = entryFileOf(dir) ?: continue
        if (!entry.isFile || entry.length() == 0L) {
          // 空壳 entry（拷贝中断/损坏）：加载必炸，直接当依赖缺失处理。
          Log.e(TAG, "plugin " + plugin.name + " entry empty: " + entry.absolutePath)
          if (!plugin.bootCritical) {
            PluginCatalog.setEnabled(context, plugin, false)
            disabled += plugin.name
          }
          continue
        }
        val text = try {
          entry.readText()
        } catch (_: Exception) {
          null
        } ?: continue
        val missing = mutableListOf<String>()
        // 入口 + 随包 node_modules 一层深度的裸 import 一起扫（递归只一层，
        // 避免误把 package.json 字段当依赖）。
        val scanFiles = mutableListOf(entry)
        File(dir, "node_modules").listFiles()?.forEach { pkgDir ->
          val name = pkgDir.name
          if (name == ".bin" || name.startsWith(".")) return@forEach
          val roots = if (name.startsWith("@")) {
            pkgDir.listFiles()?.filter { it.isDirectory } ?: emptyList()
          } else {
            listOf(pkgDir)
          }
          for (root in roots) {
            if (!root.isDirectory) continue
            val pj = File(root, "package.json")
            val main = if (pj.isFile) try {
              org.json.JSONObject(pj.readText()).optString("main")
            } catch (_: Exception) { "" } else ""
            val candidate = File(root, main.ifBlank { "lib/index.js" })
            if (candidate.isFile && candidate.length() > 0) scanFiles += candidate
            for (alt in listOf("index.js", "lib/index.mjs", "lib/index.cjs", "src/index.js")) {
              val f = File(root, alt)
              if (f.isFile && f.length() > 0) scanFiles += f
            }
          }
        }
        for (scan in scanFiles) {
          val scanText = try {
            if (scan.length() > 0 && scan.length() < 2_000_000) scan.readText() else null
          } catch (_: Exception) {
            null
          } ?: continue
          for (spec in bareImports(scanText)) {
            if (resolvable(webNm, topNm, dir, spec)) continue
            val borrowed = borrowBareDep(webNm, topNm, dshNm, spec)
            if (borrowed || resolvable(webNm, topNm, dir, spec)) continue
            // 借不到时再宽一点：只要引擎自己的 node_modules 里有同名/同名作用域包，
            // 就认为"引擎有办法解析"，只记日志不关插件（避免误杀本来能跑的插件）。
            if (existsInDsh(dshNm, spec)) {
              Log.w(TAG, "spec " + spec + " 未能在 profile 内解析，但引擎自带该包，放行")
              continue
            }
            if (!missing.contains(spec)) missing += spec
          }
        }
        if (missing.isNotEmpty()) {
          Log.e(TAG, "plugin " + plugin.name + " 依赖缺失 [" + missing.joinToString(",") + "]")
          if (plugin.bootCritical) {
            // 启动必需插件（安卓控制/删会话）不自动关：关掉会丢核心能力，
            // 依赖问题留给用户按启动报告处理。
            Log.w(TAG, "bootCritical 插件不自动关闭: " + plugin.name)
          } else {
            PluginCatalog.setEnabled(context, plugin, false)
            disabled += plugin.name
            Log.w(TAG, "已自动关闭插件: " + plugin.name)
          }
        }
      }
    } catch (t: Throwable) {
      // 预检自身出错绝不能阻断启动。
      Log.e(TAG, "plugin dep preflight failed", t)
    }
    return disabled
  }

  /** 插件在 profiles/web/node_modules 下的安装目录。 */
  private fun pluginDir(home: File, plugin: CatalogPlugin): File {
    val nm = File(home, "profiles/web/node_modules")
    return if (plugin.scoped) {
      File(File(nm, plugin.name.substringBefore('/')), plugin.name.substringAfter('/'))
    } else {
      File(nm, plugin.name)
    }
  }

  /** 插件 entry 文件：package.json 的 main（默认 lib/index.js）。 */
  private fun entryFileOf(dir: File): File? = try {
    val pkg = File(dir, "package.json")
    val main = if (pkg.isFile) org.json.JSONObject(pkg.readText()).optString("main") else ""
    File(dir, main.ifBlank { "lib/index.js" })
  } catch (_: Exception) {
    File(dir, "lib/index.js")
  }

  /** 从 JS/TS 源码里抽裸 specifier（跳过相对路径 / node: / 绝对路径 / #imports）。 */
  private fun bareImports(text: String): Set<String> {
    val out = linkedSetOf<String>()
    val res = listOf(
      Regex("""from\s*["']([^"']+)["']"""),
      Regex("""import\s*["']([^"']+)["']"""),
      Regex("""require\(\s*["']([^"']+)["']"""),
    )
    for (re in res) {
      for (m in re.findAll(text)) {
        val spec = m.groupValues[1]
        if (spec.startsWith(".") || spec.startsWith("/") ||
          spec.startsWith("node:") || spec.startsWith("#")
        ) continue
        out += spec
      }
    }
    return out
  }

  /** specifier 能否在「插件自己 / profiles/web / profiles」三处 node_modules 解析。 */
  private fun resolvable(webNm: File, topNm: File, pluginDir: File, spec: String): Boolean {
    val names = listOf(spec, pkgRootOf(spec))
    for (base in listOf(File(pluginDir, "node_modules"), webNm, topNm)) {
      for (n in names) if (File(base, n).exists()) return true
    }
    return false
  }

  /** "shiki/core" → "shiki"；"@scope/pkg/sub" → "@scope/pkg"。 */
  private fun pkgRootOf(spec: String): String {
    val parts = spec.split('/')
    return if (spec.startsWith("@")) parts.take(2).joinToString("/") else parts.first()
  }

  /**
   * 从 dsh 自带的 node_modules 借一个裸依赖出来（symlink 优先，失败退回拷目录）。
   * 兼容"作用域改名"：裸 `schemastery` 实际是 @deepseek-ai/schemastery。
   * 悬空 symlink（快照里的旧链接指向不存在的路径）会被替换成本机可用链接。
   * @return true 表示 profile 里已经能解析这个名字了。
   */
  private fun borrowBareDep(webNm: File, topNm: File, dshNm: File, spec: String): Boolean {
    val real = File(dshNm, spec).takeIf { it.exists() }
      ?: File(dshNm, "@deepseek-ai/" + pkgRootOf(spec)).takeIf { it.exists() }
      ?: return false
    var ok = false
    for (nm in listOf(webNm, topNm)) {
      val link = File(nm, spec)
      if (link.exists()) {
        ok = true
        continue
      }
      // 悬空 symlink：占着名字但 exists()==false，必须先删再建。
      if (Files.isSymbolicLink(link.toPath())) {
        try {
          Files.delete(link.toPath())
        } catch (_: Exception) {
        }
      }
      link.parentFile?.mkdirs()
      try {
        Files.createSymbolicLink(link.toPath(), real.toPath())
        Log.i(TAG, "borrow bare dep " + spec + " -> " + real.absolutePath)
        ok = true
      } catch (t: Throwable) {
        try {
          real.copyRecursively(link, overwrite = false)
          Log.i(TAG, "borrow bare dep " + spec + " (copied) -> " + link.absolutePath)
          ok = true
        } catch (e: Exception) {
          Log.w(TAG, "borrow bare dep " + spec + " failed: " + e.message)
        }
      }
    }
    return ok
  }

  /** 引擎自带 node_modules 里是否有这个名字（含"裸名 → @deepseek-ai/名"映射）。 */
  private fun existsInDsh(dshNm: File, spec: String): Boolean =
    File(dshNm, spec).exists() || File(dshNm, "@deepseek-ai/" + pkgRootOf(spec)).exists()

  /**
   * 把 profile 里的 `@deepseek-ai` 下的包链接**全部重指到 App 自己的引擎树**。
   *
   * 用户手机实况（2026-09-13 截图，两条报错都是这一件事引起的）：
   *   failed to import loader entry subprocess (@deepseek-ai/dsh-subprocess-local):
   *     Cannot find package '@deepseek-ai/dsh-subprocess-local' imported from .../profiles/web/
   *   failed to import loader entry sandbox (@deepseek-ai/dsh-sandbox-local):
   *     Cannot find the native Koffi module
   * 而堆栈里的 loader 来自 .../files/home/ds/tmp-upgrade/package/node_modules/...
   * —— profile 的链接指向了**外来/半成品的 dsh 树**（Termux 里那套、或某次升级残留），
   * 于是核心包解析不到、koffi 也拿不到 android_arm64 的原生库。
   *
   * 本机复现：把 profile 的 @deepseek-ai 链接打掉后引擎立刻报同类错；
   * 重指到引擎树（usr/.../dsh/node_modules/@deepseek-ai 下，快照内 196 个包齐全，
   * 含 dsh-subprocess-local / dsh-sandbox-local / koffi android_arm64）后正常起、curl 200。
   *
   * 判定：链接是符号链接**且**其指向不在本 App 的 usr/ 里 → 一律重指。
   * @return 重指成功的条数。
   */
  private fun repairForeignProfileLinks(home: File): Int {
    var fixed = 0
    val engineNm = File(usrDir, "lib/node_modules/@deepseek-ai/dsh/node_modules")
    val usrPrefix = usrDir.absolutePath + "/"
    for (base in listOf(File(home, "profiles/node_modules"), File(home, "profiles/web/node_modules"))) {
      val scope = File(base, "@deepseek-ai")
      if (!scope.isDirectory) continue
      val kids = scope.listFiles() ?: continue
      for (link in kids) {
        val path = link.toPath()
        if (!Files.isSymbolicLink(path)) continue
        val target = try {
          Files.readSymbolicLink(path).toString()
        } catch (_: Exception) {
          null
        } ?: continue
        // 指向本 App 引擎树 → 不动
        if (target.startsWith(usrPrefix)) continue
        val real = File(engineNm, "@deepseek-ai/" + link.name)
        if (!real.exists()) continue
        try {
          Files.delete(path)
        } catch (_: Exception) {
          continue
        }
        try {
          Files.createSymbolicLink(path, real.toPath())
          fixed++
        } catch (_: Throwable) {
          try {
            real.copyRecursively(link, overwrite = false)
            fixed++
          } catch (_: Exception) {
          }
        }
      }
    }
    if (fixed > 0) Log.w(TAG, "repointed foreign profile links -> own runtime: $fixed")
    return fixed
  }

  /** 找出"劫持解析"的外来 node_modules 根（引擎会从这里加载到别处的 dsh 树）。 */
  private fun foreignResolutionRoots(home: File): List<String> {
    val out = mutableListOf<String>()
    val usrPrefix = usrDir.absolutePath + "/"
    val roots = listOf(
      File(home, "node_modules"),
      File(File(home, ".dsh"), "node_modules"),
      File(File(home, ".dsh/profiles"), "node_modules"),
      File(File(home, ".dsh/profiles/web"), "node_modules"),
    )
    for (root in roots) {
      if (!root.exists()) continue
      // 常见形态：node_modules 或它下面的 @deepseek-ai 是链接，且指向本 App 运行时之外
      val targets = mutableListOf<Pair<String, String>>()
      if (Files.isSymbolicLink(root.toPath())) {
        val t = try {
          Files.readSymbolicLink(root.toPath()).toString()
        } catch (_: Exception) {
          ""
        }
        targets += root.absolutePath to t
      }
      val scope = File(root, "@deepseek-ai")
      if (scope.isDirectory) {
        for (k in scope.listFiles() ?: emptyArray()) {
          if (!Files.isSymbolicLink(k.toPath())) continue
          val t = try {
            Files.readSymbolicLink(k.toPath()).toString()
          } catch (_: Exception) {
            ""
          }
          if (t.isNotEmpty() && !t.startsWith(usrPrefix)) {
            targets += k.absolutePath to t
          }
        }
      }
      for ((p, t) in targets) {
        if (t.isEmpty() || !t.startsWith(usrPrefix)) out += p + " -> " + t
      }
      // 目录存在但里面没有本 App 的 dsh（说明是外来 npm 树）
      if (!Files.isSymbolicLink(root.toPath()) && out.none { it.startsWith(root.absolutePath) }) {
        val engineHere = File(File(root, "@deepseek-ai"), "dsh/node_modules/@deepseek-ai/dsh-base")
        if (scope.isDirectory && !engineHere.exists()) {
          out += root.absolutePath + "（外部 npm 树，非本 App 运行时）"
        }
      }
    }
    return out
  }

  /**
   * 运行时体检：关键件缺失/被外来树顶掉时，必须丢掉现有 usr/ 用内嵌快照重解压。
   *
   * 为什么必须做：`snapshotFresh()` 原先只要 `.online-fingerprint` 存在就直接
   * 认为运行时没问题 —— 一旦那棵在线运行时是坏的（用户手机上正是如此，引擎在
   * home/ds/tmp-upgrade/package 那棵残树里跑），App 就被永久卡死，怎么升级 APK
   * 都不会换运行时。这就是"一直打不开"的根。
   * @return 问题清单（空 = 健康）。
   */
  private fun runtimeProblems(): List<String> {
    val issues = mutableListOf<String>()
    val dsh = File(usrDir, "lib/node_modules/@deepseek-ai/dsh")
    val engine = File(dsh, "node_modules/@deepseek-ai")
    // 1) 引擎树本身被换成符号链接 → 外来运行时
    if (Files.isSymbolicLink(dsh.toPath())) {
      issues += "dsh 目录是符号链接（外来运行时）"
    } else {
      val real = try {
        dsh.canonicalPath
      } catch (_: Exception) {
        ""
      }
      if (real.isNotEmpty() && !real.startsWith(usrDir.canonicalPath + File.separator)) {
        issues += "dsh 不在本 App 运行时内"
      }
    }
    // 2) 关键件在不在
    val must = listOf(
      File(usrDir, "bin/node"),
      File(usrDir, "lib/libtermux-exec-ld-preload.so"),
      File(dsh, "package.json"),
      File(dsh, "lib/bin.js"),
      File(engine, "dsh-app-boot/lib/index.js"),
      File(engine, "cordis-plugin-loader/lib/index.js"),
      File(engine, "dsh-base/package.json"),
      File(engine, "dsh-subprocess-local/package.json"),
      File(engine, "dsh-sandbox-local/package.json"),
      File(dsh, "node_modules/koffi/build/koffi/android_arm64"),
    )
    for (f in must) {
      if (!f.exists()) issues += f.absolutePath.removePrefix(usrDir.absolutePath + "/")
    }
    // 3) 有外来 node_modules 根在劫持解析（手机实况：引擎从 home/ds/tmp-upgrade/package 起）
    issues.addAll(foreignResolutionRoots(homeDir))
    return issues
  }

  /**
   * 丢掉外来/损坏的运行时残骸（重解压前的清场）。
   * 只删确定是残骸的东西：usr 或 dsh 若是符号链接、以及 home/ds/tmp-upgrade 这类
   * 升级残留目录（截图里引擎就是从那里跑起来的）。用户数据（sessions/settings/凭据）
   * 不在这些路径下，不受影响。
   */
  private fun dropForeignRuntime() {
    try {
      val dsh = File(usrDir, "lib/node_modules/@deepseek-ai/dsh")
      if (Files.isSymbolicLink(dsh.toPath())) {
        Files.deleteIfExists(dsh.toPath())
        Log.w(TAG, "dropped symlinked dsh runtime")
      }
      if (Files.isSymbolicLink(usrDir.toPath())) {
        Files.deleteIfExists(usrDir.toPath())
        Log.w(TAG, "dropped symlinked usr")
      }
      // 外来 npm 树：整个移开（改名留证，不直接删），避免继续劫持解析
      val stamp = System.currentTimeMillis().toString()
      val roots = listOf(
        File(homeDir, "node_modules"),
        File(File(homeDir, ".dsh"), "node_modules"),
      )
      for (root in roots) {
        if (root.exists() && !Files.isSymbolicLink(root.toPath())) {
          val bak = File(root.parentFile, root.name + ".foreign-" + stamp)
          if (root.renameTo(bak)) {
            Log.w(TAG, "moved foreign resolution root aside: " + bak.absolutePath)
          }
        }
      }
      // 升级残留：home/ds/tmp-upgrade*（引擎曾被从这里启动）
      val home = homeDir
      for (cand in listOf(
        File(home, "ds/tmp-upgrade"),
        File(home, "ds/tmp-upgrade/package"),
      )) {
        if (cand.exists() && cand.isDirectory) {
          var ok = false
          try {
            Files.deleteIfExists(cand.toPath())
            ok = true
          } catch (_: Exception) {
          }
          if (!ok && cand.deleteRecursively()) ok = true
          if (ok) Log.w(TAG, "dropped stale upgrade dir: " + cand.absolutePath)
        }
      }
    } catch (t: Throwable) {
      Log.e(TAG, "dropForeignRuntime failed", t)
    }
  }

  /**
   * 隔离"上次把引擎拖垮的那条 entry"。
   *
   * cordis 是 fail-loud：只要有一条 entry import/apply 失败，整棵插件树倒、进程立刻退出
   * （界面只能看到 Promise.allSettled 和堆栈尾巴）。到底是哪条，只有引擎自己的
   * engine.log 写着，所以这里直接扫日志原文里的
   *   failed to import loader entry <id> (<pkg>)   /   failed to apply ...
   * 命中就把该 entry 从 cordis.patch.yml 摘掉：insert 块整块删、工厂行补 disabled，
   * 并记进 SharedPreferences —— 下次启动 applyToggles 也不会再插回来。
   * 于是重试是**收敛**的：每崩一次少一条坏 entry，而不是反复撞同一堵墙。
   *
   * 本机拿真快照复现过：把 sandbox 那一行 disabled，引擎立刻能 bind 端口、
   * 其余 entry 全部就绪 ⇒ 失败的确实只是"某一条 entry"，不是整棵树。
   * @return 本次隔离的 entry 名（写进启动报告）。
   */
  private fun applyQuarantine(home: File): List<String> {
    val applied = mutableListOf<String>()
    try {
      val patch = File(home, "profiles/web/cordis.patch.yml")
      if (!patch.isFile) return applied
      val prefs = context.getSharedPreferences(QUARANTINE_PREFS, Context.MODE_PRIVATE)
      val ids = java.util.HashSet(prefs.getStringSet(KEY_QUARANTINE, emptySet()) ?: emptySet())
      val log = File(context.filesDir, "engine.log")
      if (log.isFile && log.length() > 0) {
        ids.addAll(quarantineIdsFromLog(log.readText().takeLast(400_000)))
      }
      if (ids.isEmpty()) return applied
      prefs.edit().putStringSet(KEY_QUARANTINE, ids).apply()
      val original = patch.readText()
      var yml = original
      for (id in ids) {
        val before = yml
        yml = stripInsertBlock(yml, id)
        if (yml != before) {
          applied += id
        } else if (hasFactoryRow(yml, id) && !hasDisabledRow(yml, id)) {
          yml = yml.trimEnd() + "\n" + "- id: " + id + "\n" + "  disabled: true" + "\n"
          applied += id
        }
      }
      if (yml != original) {
        patch.writeText(if (yml.endsWith("\n")) yml else yml + "\n")
        Log.w(TAG, "quarantined entries: " + applied.joinToString(", "))
      }
      if (applied.isNotEmpty()) {
        for (plugin in PluginCatalog.list(context)) {
          if (applied.any { it == plugin.id || it == plugin.name }) {
            PluginCatalog.setEnabled(context, plugin, false)
          }
        }
      }
    } catch (t: Throwable) {
      Log.e(TAG, "applyQuarantine failed", t)
    }
    return applied
  }

  /** 从 engine.log 扫出"加载失败的 entry id"（纯字符串扫描，不用正则，避免转义坑）。 */
  private fun quarantineIdsFromLog(text: String): Set<String> {
    val out = linkedSetOf<String>()
    for (marker in listOf(
      "failed to import loader entry ",
      "failed to apply loader entry ",
    )) {
      var i = text.indexOf(marker)
      while (i >= 0) {
        val rest = text.substring(i + marker.length)
        val cuts = listOf(rest.indexOf(' '), rest.indexOf('('), rest.indexOf('\n'))
          .filter { it > 0 }
        val end = cuts.minOrNull() ?: minOf(rest.length, 64)
        val id = rest.substring(0, end).trim()
        if (id.isNotEmpty() && id != "include") out += id
        i = text.indexOf(marker, i + marker.length)
      }
    }
    return out
  }

  /** 工厂行：顶层 `- id: <id>`。 */
  private fun hasFactoryRow(yml: String, id: String): Boolean {
    for (line in yml.split('\n')) {
      if (line.trim() == "- id: " + id) return true
    }
    return false
  }

  /** 该工厂行下面是否已经是 disabled: true。 */
  private fun hasDisabledRow(yml: String, id: String): Boolean {
    val lines = yml.split('\n')
    for (k in lines.indices) {
      if (lines[k].trim() == "- id: " + id && k + 1 < lines.size &&
        lines[k + 1].trim() == "disabled: true"
      ) {
        return true
      }
    }
    return false
  }

  /** 整块删掉一个 `- insert:` 块（块内出现该 id 才算命中）。 */
  private fun stripInsertBlock(text: String, id: String): String {
    val lines = text.split('\n')
    val out = ArrayList<String>(lines.size)
    var i = 0
    while (i < lines.size) {
      if (lines[i].trim() == "- insert:") {
        var j = i + 1
        val block = StringBuilder(lines[i])
        while (j < lines.size && (lines[j].isBlank() ||
            lines[j].startsWith(" ") || lines[j].startsWith("\t"))
        ) {
          block.append('\n').append(lines[j])
          j++
        }
        block.append('\n')
        if (block.contains("id: " + id + "\n") || block.contains("id: '" + id + "'")) {
          i = j
          continue
        }
        out.add(lines[i])
        i++
        continue
      }
      out.add(lines[i])
      i++
    }
    return out.joinToString("\n")
  }

  /**
   * 把 cordis.patch.yml 引用、但引擎树里没有的插件，链接进引擎自己的 node_modules。
   * 本机复现过 loader 的解析基准就是引擎树（报错原文 imported from
   * .../dsh/node_modules/@deepseek-ai/cordis-plugin-loader/lib/index.js）。
   * 缺谁补谁，已能解析的跳过；失败只记日志，不阻断启动。
   * @return 本次新建的链接名。
   */
  private fun linkEngineVisiblePlugins(home: File): List<String> {
    val linked = mutableListOf<String>()
    try {
      val engineNm = File(usrDir, "lib/node_modules/@deepseek-ai/dsh/node_modules")
      val webNm = File(home, "profiles/web/node_modules")
      val topNm = File(home, "profiles/node_modules")
      val patch = File(home, "profiles/web/cordis.patch.yml")
      if (!patch.isFile || !engineNm.isDirectory) return linked
      for (name in patchPluginNames(patch.readText())) {
        if (File(engineNm, name).exists()) continue
        val src = listOf(webNm, topNm).map { File(it, name) }.firstOrNull { it.exists() } ?: continue
        val dst = File(engineNm, name)
        if (dst.exists()) continue
        dst.parentFile?.mkdirs()
        try {
          Files.createSymbolicLink(dst.toPath(), src.toPath())
          linked += name
        } catch (t: Throwable) {
          try {
            src.copyRecursively(dst, overwrite = false)
            linked += name
          } catch (e: Exception) {
            Log.e(TAG, "engine-visible link failed: " + name, e)
          }
        }
      }
      if (linked.isNotEmpty()) Log.w(TAG, "engine-visible links: " + linked.joinToString(", "))
    } catch (t: Throwable) {
      Log.e(TAG, "linkEngineVisiblePlugins failed", t)
    }
    return linked
  }

  /** 抽出 cordis patch 里所有 name: 值（去引号、去 cordis: 内置件）。 */
  private fun patchPluginNames(yml: String): Set<String> {
    val out = linkedSetOf<String>()
    for (line in yml.split('\n')) {
      val t = line.trim()
      if (!t.startsWith("name:")) continue
      var v = t.substring(5).trim()
      v = v.trim('"').trim('\'').trim()
      if (v.isEmpty() || v.startsWith("cordis:")) continue
      out += v
    }
    return out
  }

  /** 启动报告（插件自动关闭 / 引擎日志尾巴），排障时给用户一份可复制的文本。 */
  private fun writeStartupReport(
    autoDisabled: List<String>,
    quarantined: List<String> = emptyList(),
    linked: List<String> = emptyList(),
  ) {
    try {
      val sb = StringBuilder()
      sb.append("dsh-mobile 启动报告  ").append(java.util.Date()).append('\n')
      sb.append("appVersionCode: ").append(appVersionCode()).append('\n')
      if (autoDisabled.isEmpty()) {
        sb.append("插件依赖预检: 全部通过").append('\n')
      } else {
        sb.append("插件依赖预检: 以下插件因依赖缺失被自动关闭 → ")
          .append(autoDisabled.joinToString(", ")).append('\n')
      }
      if (quarantined.isNotEmpty()) {
        sb.append("已隔离（上次拖垮引擎的 entry）→ ").append(quarantined.joinToString(", ")).append("\n")
      }
      if (linked.isNotEmpty()) {
        sb.append("已补引擎可见链接 → ").append(linked.joinToString(", ")).append("\n")
      }
      val log = File(context.filesDir, "engine.log")
      if (log.isFile && log.length() > 0) {
        val tail = log.readText().takeLast(4096)
        sb.append("\n--- engine.log 末尾 ---\n").append(tail)
      }
      File(context.filesDir, "startup-report.txt").writeText(sb.toString())
    } catch (_: Exception) {
    }
  }

  /** 本 App 的 versionCode（用于插件树随 APK 升级强制重铺）。 */
  private fun appVersionCode(): Int = try {
    val pi = context.packageManager.getPackageInfo(context.packageName, 0)
    if (android.os.Build.VERSION.SDK_INT >= 28) pi.longVersionCode.toInt() else @Suppress("DEPRECATION") pi.versionCode
  } catch (_: Exception) {
    0
  }

  /** 首次启动把电脑记忆种进手机 HOME/.dsh/memories（已有文件不覆盖）。 */
  private fun seedDesktopMemories() {
    val dest = File(homeDir, ".dsh/memories")
    if (File(dest, "MEMORY.md").exists()) return
    try {
      dest.mkdirs()
      copyAssetTree("seed-memories", dest)
      Log.i(TAG, "seeded desktop memories -> " + dest.absolutePath)
    } catch (e: Exception) {
      Log.e(TAG, "seed memories failed", e)
    }
  }

  /** 把内置教材拷到 HOME，供休闲区读取（幂等：已有文件不覆盖）。 */
  private fun seedLeisureBook() {
    val books = listOf("ckj.json", "math2-calculus.json")
    for (name in books) {
      val dest = File(homeDir, "leisure-books/$name")
      if (dest.exists() && dest.length() > 0) continue
      try {
        dest.parentFile?.mkdirs()
        context.assets.open("patched/leisure-books/$name").use { input ->
          dest.outputStream().use { out -> input.copyTo(out) }
        }
        Log.i(TAG, "seeded leisure book -> " + dest.absolutePath)
      } catch (e: Exception) {
        Log.e(TAG, "seed leisure book failed: $name", e)
      }
    }
  }

  /**
   * 安装 dsh-android-control 安卓控制插件到快照 profile（幂等）：
   *  1) 把 assets/patched/dsh-android-control/{index.js,package.json,cordis.patch.yml,lib/client.js}
   *     复制到 DSH profiles 的 node_modules 下（与 @dsh-android 同级）；
   *  2) 在 profiles/web/node_modules/ 建 dsh-android-control 链接（DSH profile
   *     模块解析靠自身 node_modules 树）。
   *  插件经 cordis.patch.yml insert 由 DSH 引擎装载（见 applyAssetPatchAppend
   *  对 cordis.patch.yml 的追加），此处只负责把包文件放到位。
   */
  private fun installAndroidControlPlugin(home: File) {
    try {
      // DSH profile 期解析在 HOME/.dsh/profiles/web；node_modules 是其内部目录。
      val webNodeModules = File(home, "profiles/web/node_modules")
      val pluginDir = File(webNodeModules, "dsh-android-control")
      if (File(pluginDir, "index.js").exists()) return // 已安装
      pluginDir.mkdirs()
      val files = listOf(
        "index.js", "package.json", "cordis.patch.yml",
      )
      for (name in files) {
        context.assets.open("patched/dsh-android-control/$name").use { input ->
          File(pluginDir, name).outputStream().use { out -> input.copyTo(out) }
        }
      }
      // lib/client.js
      val libDir = File(pluginDir, "lib").apply { mkdirs() }
      context.assets.open("patched/dsh-android-control/lib/client.js").use { input ->
        File(libDir, "client.js").outputStream().use { out -> input.copyTo(out) }
      }
      // profile 顶层 node_modules 也放一份（某些 DSH 版本从这里解析）
      val topNodeModules = File(home, "profiles/node_modules")
      val topPlugin = File(topNodeModules, "dsh-android-control")
      if (!File(topPlugin, "index.js").exists()) {
        topPlugin.mkdirs()
        for (name in files) {
          context.assets.open("patched/dsh-android-control/$name").use { input ->
            File(topPlugin, name).outputStream().use { out -> input.copyTo(out) }
          }
        }
        val topLib = File(topPlugin, "lib").apply { mkdirs() }
        context.assets.open("patched/dsh-android-control/lib/client.js").use { input ->
          File(topLib, "client.js").outputStream().use { out -> input.copyTo(out) }
        }
      }
      Log.i(TAG, "dsh-android-control installed to " + pluginDir.absolutePath)
    } catch (e: Exception) {
      Log.e(TAG, "install dsh-android-control failed", e)
    }
  }

  /**
   * 安装桌面对口插件到快照 profile（幂等，装一次）。插件来自
   * assets/patched/<assetDir>/（含 package.json + lib|src）。
   * @param scoped true = @dsh-external/dsh-model-failover 这类带 scope 的包，
   *  装入 profiles/web/node_modules/@scope/pkg。
   */
  private fun installMobilePlugin(assetDir: String, pkgName: String, home: File, scoped: Boolean) {
    try {
      val webNodeModules = File(home, "profiles/web/node_modules")
      val target = if (scoped) {
        val scope = pkgName.substringBefore('/')
        File(File(webNodeModules, scope), pkgName.substringAfter('/'))
      } else {
        File(webNodeModules, pkgName)
      }
      val bundledVersion = assetPluginVersion(assetDir)
      if (syncPluginTree(assetDir, target, bundledVersion)) {
        Log.i(TAG, "desktop plugin synced: $pkgName -> " + target.absolutePath)
      }
      // DSH loader 需要 profiles 顶层 node_modules 也能解析（部分版本）。
      val topTarget = if (scoped) {
        val scope = pkgName.substringBefore('/')
        File(File(File(home, "profiles/node_modules"), scope), pkgName.substringAfter('/'))
      } else {
        File(File(home, "profiles/node_modules"), pkgName)
      }
      syncPluginTree(assetDir, topTarget, bundledVersion)
      // 是否写入 cordis 由 PluginCatalog.applyToggles 按开关决定。
    } catch (e: Exception) {
      Log.e(TAG, "install desktop plugin $pkgName failed", e)
    }
  }

  /**
   * 把内置插件铺到 target —— 只在"确认已铺好"时跳过。
   *
   * 判据（.dsh-bundled.json 标记）：版本 + 资产文件数 + App versionCode 三者全一致才算已铺好。
   *   - 标记缺失 ⇒ 重铺（老版本铺过的目录都没有标记 ⇒ 升级后必然重铺一次，
   *     这是 v0.15.2 的漏洞：它只比版本号，而手机上坏掉的 imagegen 恰好也是
   *     1.5.1（版本相同、node_modules 缺失）⇒ 被跳过 ⇒ 依旧起不来）；
   *   - App versionCode 变了 ⇒ 重铺（内置插件改动随 APK 生效）。
   * @return true 表示本次真的写了文件。
   */
  private fun syncPluginTree(assetDir: String, target: File, bundledVersion: String?): Boolean {
    val bundledFiles = assetFileCount("patched/$assetDir")
    val pkg = File(target, "package.json")
    val present = pkg.exists() && pkg.length() > 0
    if (present && markerMatches(target, bundledVersion, bundledFiles)) return false
    if (present) {
      Log.i(TAG, "plugin $assetDir re-layout (version=" + (bundledVersion ?: "?") +
        ", files=" + bundledFiles + ", appVc=" + appVersionCode() + ")")
      if (!target.deleteRecursively()) Log.w(TAG, "plugin dir delete failed: " + target.absolutePath)
    }
    target.mkdirs()
    copyAssetTree("patched/$assetDir", target)
    val copied = countFiles(target) - 1 // 减掉标记文件自身
    if (copied < bundledFiles) {
      // 拷贝不完整（磁盘满/中断）：不写标记，下次启动重铺。
      Log.e(TAG, "plugin $assetDir copy incomplete: " + copied + "/" + bundledFiles)
      File(target, PLUGIN_MARKER).delete()
      return true
    }
    try {
      File(target, PLUGIN_MARKER).writeText(
        org.json.JSONObject().apply {
          put("version", bundledVersion ?: "")
          put("files", bundledFiles)
          put("appVersionCode", appVersionCode())
        }.toString(),
      )
    } catch (e: Exception) {
      Log.w(TAG, "plugin marker write failed: " + e.message)
    }
    return true
  }

  /** 标记文件是否与当前 APK 内的插件资产一致。 */
  private fun markerMatches(target: File, bundledVersion: String?, bundledFiles: Int): Boolean = try {
    val o = org.json.JSONObject(File(target, PLUGIN_MARKER).readText())
    o.optString("version") == (bundledVersion ?: "") &&
      o.optInt("files") == bundledFiles &&
      o.optInt("appVersionCode") == appVersionCode()
  } catch (_: Exception) {
    false
  }

  /** 数一棵资产子树里的文件数（assets.list 对文件返回空数组，对目录返回子项）。 */
  private fun assetFileCount(assetPrefix: String): Int {
    var n = 0
    val stack = ArrayDeque<String>()
    stack.addLast(assetPrefix)
    while (stack.isNotEmpty()) {
      val p = stack.removeLast()
      val children = try {
        context.assets.list(p)
      } catch (_: Exception) {
        null
      } ?: continue
      if (children.isEmpty()) {
        n++
      } else {
        for (c in children) stack.addLast(p + "/" + c)
      }
    }
    return n
  }

  /** 数目录里的文件数（不含目录）。 */
  private fun countFiles(dir: File): Int = try {
    dir.walkTopDown().count { it.isFile }
  } catch (_: Exception) {
    -1
  }

  /** 读 assets/patched/<assetDir>/package.json 的 version（读不到返回 null）。 */
  private fun assetPluginVersion(assetDir: String): String? = try {
    context.assets.open("patched/$assetDir/package.json").bufferedReader().use {
      org.json.JSONObject(it.readText()).optString("version").ifBlank { null }
    }
  } catch (_: Exception) {
    null
  }

  /** 把 assets 下的一棵目录树复制到目标目录（递归）。 */
  private fun copyAssetTree(assetPrefix: String, target: File) {
    try {
      val list = context.assets.list(assetPrefix) ?: emptyArray()
      for (name in list) {
        val assetPath = if (assetPrefix.isEmpty()) name else "$assetPrefix/$name"
        val isDir = context.assets.list(assetPath)?.isNotEmpty() == true
        val t = File(target, name)
        if (isDir) {
          t.mkdirs()
          copyAssetTree(assetPath, t)
        } else {
          context.assets.open(assetPath).use { input ->
            t.outputStream().use { out -> input.copyTo(out) }
          }
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "copyAssetTree $assetPrefix failed", e)
    }
  }

  /** 覆盖式补丁：目标已含标记串则跳过。 */
  private fun applyAssetPatch(asset: String, target: File, marker: String) {
    if (target.exists() && target.readText().contains(marker)) return
    try {
      context.assets.open(asset).use { input ->
        target.parentFile?.mkdirs()
        target.outputStream().use { out -> input.copyTo(out) }
      }
      Log.i(TAG, "runtime patch applied: $asset -> $target")
    } catch (e: Exception) {
      Log.e(TAG, "runtime patch failed: $asset", e)
    }
  }

  /** 追加式补丁（用于 cordis.patch.yml，保留用户已有条目）。 */
  private fun applyAssetPatchAppend(asset: String, target: File, marker: String) {
    if (target.exists() && target.readText().contains(marker)) return
    try {
      val content = context.assets.open(asset).bufferedReader().use { it.readText() }
      target.parentFile?.mkdirs()
      val existing = if (target.exists()) target.readText() else ""
      val sep = if (existing.isNotBlank() && !existing.endsWith("\n")) "\n" else ""
      target.writeText(existing + sep + content)
      Log.i(TAG, "runtime patch appended: $asset -> $target")
    } catch (e: Exception) {
      Log.e(TAG, "runtime patch failed: $asset", e)
    }
  }

  /**
   * 裸引擎修复：关掉 mcp-vision 插件行，确保 ui-layout 可用，
   * 供四级兜底在重启前调用。不删 shell-termux / pwsh-fix 等工厂块。
   */
  fun applyBareBootRepairs() {
    try {
      val home = File(homeDir, ".dsh")
      val patch = File(home, "profiles/web/cordis.patch.yml")
      if (patch.isFile) {
        var text = patch.readText().replace("\r\n", "\n")
        // 整块删除 mcp-vision insert（空 key 或加载失败时会拖垮 cordis）。
        val lines = text.split("\n").toMutableList()
        val out = ArrayList<String>(lines.size)
        var i = 0
        while (i < lines.size) {
          val line = lines[i]
          if (line.trim() == "- insert:" && i + 2 < lines.size &&
            lines[i + 1].contains("mcp-vision") &&
            lines[i + 2].contains("dsh-mcp-client")
          ) {
            i += 3
            // 跳过 config 块（缩进更深的连续行）
            while (i < lines.size && (lines[i].isBlank() || lines[i].startsWith(" ") || lines[i].startsWith("\t"))) {
              // 只吞属于本 insert 的缩进行；顶层 "- " 开头停下
              if (lines[i].trim().startsWith("- ") && lines[i].trim() != "- insert:") break
              i++
            }
            continue
          }
          out.add(line)
          i++
        }
        text = out.joinToString("\n")
        patch.writeText(if (text.endsWith("\n")) text else text + "\n")
        Log.w(TAG, "bare boot: stripped mcp-vision from cordis.patch.yml")
      }
      ensureFactoryProfile(home)
    } catch (t: Throwable) {
      Log.e(TAG, "applyBareBootRepairs failed", t)
    }
  }

  /** Start the dsh web engine from the embedded snapshot. */
  fun startEngine(port: Int = 3080): Boolean {
    // LD_PRELOAD 依赖快照内的 termux-exec 库：缺失时所有子进程 exec 会失败，
    // 且叠加冷却窗口 = 引擎静默停摆 90s——启动前显式断言，缺失即 loud fail。
    val preload = File(usrDir, "lib/libtermux-exec-ld-preload.so")
    if (!preload.exists()) {
      Log.e(TAG, "engine start failed: termux-exec preload missing at " + preload.absolutePath)
      return false
    }
    // 进程级 CAS：并发调用只有一个能真正启动（设备实证 EADDRINUSE 双启动）。
    if (!STARTING.compareAndSet(false, true)) {
      return EngineProbe.check(200).optBoolean("running", false)
    }
    return try {
      // 已有进程还活着且探活通过 → 真成功，不必再 spawn。
      val existing = engineProcess
      if (existing != null && existing.isAlive) {
        if (EngineProbe.check(400).optBoolean("running", false)) {
          earlyCrashCount = 0
          return true
        }
        // 进程在但探活失败：杀掉重来，不进 90s 假死冷却。
        existing.destroy()
        engineProcess = null
        EngineManager.lastStartAttemptAt = 0
      } else if (existing != null) {
        // 僵尸 Process 对象：清掉并放开冷却，否则看门狗 90s 内只能空转 return true。
        engineProcess = null
        EngineManager.lastStartAttemptAt = 0
      }

      val now = System.currentTimeMillis()
      val processAlive = engineProcess?.isAlive == true
      if (processAlive && now - EngineManager.lastStartAttemptAt < START_COOLDOWN_MS) {
        return true
      }

      applyRuntimePatches()
      ShizukuManager.ensureBridgeRunning(context)
      // 清残留 bin.js（EADDRINUSE / 旧插件树占端口）。
      try {
        Runtime.getRuntime().exec(arrayOf("/system/bin/pkill", "-f", "bin.js")).waitFor()
      } catch (_: Throwable) {
      }
      Thread.sleep(400)

      val args = arrayOf(
        nodeBin.absolutePath, "--expose-internals", dshBin.absolutePath, "web", "--port", port.toString(),
      )
      val proc = startWithArgs(args, shellEnv())
      engineProcess = proc
      EngineManager.lastStartAttemptAt = now
      LogCollector.log(TAG, "engine spawned pid-ish alive=" + proc.isAlive)
      // 早夭检测：15s 内退出立刻清冷却；连崩 2 次切 ultra-safe cordis。
      Thread {
        try {
          val code = proc.waitFor()
          val age = System.currentTimeMillis() - EngineManager.lastStartAttemptAt
          Log.w(TAG, "engine process exited code=$code ageMs=$age")
          LogCollector.log(TAG, "engine process exited code=$code ageMs=$age")
          if (engineProcess === proc) {
            engineProcess = null
            if (age < 15_000) {
              EngineManager.lastStartAttemptAt = 0
              earlyCrashCount++
              Log.w(TAG, "early crash #$earlyCrashCount")
              LogCollector.log(TAG, "early crash #$earlyCrashCount")
            }
          }
        } catch (_: Throwable) {
        }
      }.start()
      true
    } catch (t: Throwable) {
      Log.e(TAG, "engine start failed", t)
      LogCollector.log(TAG, "engine start FAILED: " + (t.message ?: t.javaClass.simpleName))
      EngineManager.lastStartAttemptAt = 0
      false
    } finally {
      STARTING.set(false)
    }
  }

  /**
   * Spawn the engine, falling back to the system linker when the direct exec
   * is denied: Android 15+ apps targeting SDK 35+ may not exec app-data ELF
   * binaries, but loading them through /system/bin/linker64 is the same
   * mechanism as native libraries (always permitted for app data).
   */
  private fun startWithArgs(args: Array<String>, env: Map<String, String>): Process {
    val log = File(context.filesDir, "engine.log")
    fun build(argv: List<String>): ProcessBuilder =
      ProcessBuilder(argv).also { b ->
        b.environment().putAll(env)
        b.redirectErrorStream(true)
        b.redirectOutput(log)
      }
    return try {
      build(args.toList()).start()
    } catch (e: java.io.IOException) {
      if (e.message?.contains("Permission denied") != true) throw e
      Log.w(TAG, "direct exec denied, falling back to linker64: " + e.message)
      build(listOf("/system/bin/linker64") + args.toList()).start()
    }
  }

  /** 引擎进程是否已退出（兜底流程用它避免死等满超时：cordis 崩是秒退）。 */
  val engineExited: Boolean get() = engineProcess?.isAlive != true

  /** Stop the engine process (best-effort). */
  fun stopEngine() {
    engineProcess?.destroy()
    engineProcess = null
    LogCollector.log(TAG, "engine stopped (manual)")
    // 手动停止后重置冷却：用户回前台应立即允许重新启动。
    EngineManager.lastStartAttemptAt = 0
  }

  /**
   * 引擎/控制台/日志进程共用的快照环境（PATH/LD_LIBRARY_PATH/HOME/DSH_HOME/
   * TERMUX_* 显式注入——快照自足，不依赖 Termux app）。幂等：可安全多次
   * 调用（ensurePrivateDshData 与 TMPDIR mkdirs 均幂等）。
   */
  fun shellEnv(): Map<String, String> {
    val preload = File(usrDir, "lib/libtermux-exec-ld-preload.so")
    return mapOf(
      "PATH" to (usrDir.absolutePath + "/bin:/system/bin"),
      "LD_LIBRARY_PATH" to (usrDir.absolutePath + "/lib"),
      "HOME" to homeDir.absolutePath,
      // DSH_HOME 始终保持在私有域（FUSE 禁 symlink，公共域无法维护
      // profiles/node_modules flat fallback）；运行时用户数据全部在私有
      // files/home/.dsh，公共 Documents/dshdata 仅作导出仓库。
      "DSH_HOME" to ensurePrivateDshData().absolutePath,
      // os.tmpdir() falls back to the baked-in Termux tmp on Android
      // (unwritable from the app domain); keep spill inside filesDir.
      "TMPDIR" to File(homeDir, "tmp").apply { mkdirs() }.absolutePath,
      // Android 16 forbids exec of app-data ELF regardless of targetSdk
      // (observed on Android 16/vivo: direct exec EACCES even at targetSdk
      // 34). Termux's execve hook re-routes denied execs through
      // /system/bin/linker64 (same mechanism as JNI libs); the snapshot
      // ships libtermux-exec-*-ld-preload.so. The hook only rewrites for
      // untrusted_app_25/27 SELinux domains, so force mode is required.
      "LD_PRELOAD" to preload.absolutePath,
      "TERMUX_EXEC__SYSTEM_LINKER_EXEC__MODE" to "force",
      "TERMUX_EXEC__EXECVE_CALL__INTERCEPT" to "1",
      "TERMUX__ROOTFS" to usrDir.parentFile.absolutePath,
      "TERMUX__PREFIX" to usrDir.absolutePath,
      "TERMUX_APP__DATA_DIR" to context.filesDir.parentFile.absolutePath,
      "TERMUX_APP__LEGACY_DATA_DIR" to "/data/data/com.dshmobile.shell",
      "TERMUX_VERSION" to "0.118.3",
      // 目录选择桥端点鉴权 token（web-compat 插件校验 x-dsh-pick-token）。
      "DSH_PICK_TOKEN" to (pickToken ?: ""),
      // 视觉后端（Qwen-VL）API key：从私有文件读取，避免硬编码进源码。
      "DASHSCOPE_API_KEY" to (File(context.filesDir, "dashscope-key.txt").takeIf { it.exists() }?.readText()?.trim() ?: ""),
      // Shizuku 桥接环境变量（dsh-android-control 插件读取 DSH_BRIDGE_PORT
      // 和 token 文件路径；插件本身通过 process.env.HOME + '/.dsh-bridge-token'
      // 读取 token，引擎 HOME 已指向 homeDir）。
      "DSH_BRIDGE_PORT" to ShizukuBridgeServer.BRIDGE_PORT.toString(),
      // 让桌面插件能 import "ws" / "schemastery"（它们只在 dsh 内部 node_modules）。
      "NODE_PATH" to File(usrDir, "lib/node_modules/@deepseek-ai/dsh/node_modules").absolutePath,
      "DSH_LEISURE_BOOK_CKJ" to File(homeDir, "leisure-books/ckj.json").absolutePath,
      // 考研数学二高数公式教材（休闲区书库第二本，2026-08-22）。
      "DSH_LEISURE_BOOK_MATH2" to File(homeDir, "leisure-books/math2-calculus.json").absolutePath,
    ) + ShizukuManager.envInject()
  }

  companion object {
    private const val TAG = "dsh-engine"

    /** 插件树完整性标记（写在插件目录里；版本/文件数/App versionCode 三者全中才跳过重铺）。 */
    private const val PLUGIN_MARKER = ".dsh-bundled.json"

    /** 隔离集合（SharedPreferences）：上次把引擎拖垮、下次启动不再挂的 entry id。 */
    private const val QUARANTINE_PREFS = "dsh_engine_quarantine"
    private const val KEY_QUARANTINE = "entries"

    /** Watchdog/retry backoff: no new start within this window of the last
     *  attempt. Cold node boot on the phone takes 20-45s (plugin tree + first
     *  bind); a 5s watchdog poll would otherwise race a healthy boot and
     *  double-start the engine (device-observed EADDRINUSE). 90s covers the
     *  slowest observed boot with margin. */
    const val START_COOLDOWN_MS = 90_000L

    /** 进程级启动 CAS：跨 EngineManager 实例可见（双启动竞态防护）。 */
    val STARTING = java.util.concurrent.atomic.AtomicBoolean(false)

    /** 上次真实启动时刻（epoch ms）；watchdog 冷却窗口基准。 */
    @Volatile
    var lastStartAttemptAt: Long = 0

    /** 15s 内早夭次数；≥2 时改用 ultra-safe cordis（去掉 Android 专用插件行）。 */
    @Volatile
    @JvmStatic
    var earlyCrashCount: Int = 0

    /**
     * 进程级共享的目录选择鉴权 token（C1 修复，2026-08-16）：
     * 首次生成后进程内所有 EngineManager 实例复用——MainActivity 重建、
     * EngineService 看门狗重启引擎都不会丢失/更换 token，引擎侧
     * fail-closed（空 token 拒绝）后鉴权依然自洽。
     */
    @Volatile
    var sharedPickToken: String? = null

    /** 获取（或首次生成）进程级 pick token。 */
    fun ensurePickToken(): String {
      sharedPickToken?.let { return it }
      val token = java.util.UUID.randomUUID().toString()
      sharedPickToken = token
      return token
    }
  }
}
