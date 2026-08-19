package com.dshmobile.shell

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import org.json.JSONObject

/**
 * Runtime snapshot online update (M2): fetch a manifest {url, sha256, size},
 * download the snapshot, verify, extract to usr-new, then atomically swap
 * usr → usr-old / usr-new → usr. The engine restart is handled by the
 * EngineService watchdog on the next poll.
 */
class UpdateManager(private val context: Context) {

  /**
   * Manifest URL override for testing (emulator reaches the host via
   * 10.0.2.2). Production builds point at a real release server.
   */
  var manifestUrl: String = DEFAULT_MANIFEST_URL

  /**
   * Run the update flow on a background thread.
   * @param onStatus progress text callback (any thread).
   */
  fun checkAndApply(onStatus: (String) -> Unit) {
    Thread {
      val tmp = File(context.filesDir, "update.tar.xz")
      val stage = File(context.filesDir, "update-stage")
      try {
        onStatus("检查更新…")
        requireHttps(manifestUrl, "manifest")
        val manifest = JSONObject(fetch(manifestUrl))
        val url = manifest.getString("url")
        requireHttps(url, "snapshot")
        val expectedSha = manifest.optString("sha256", "")
        if (expectedSha.isEmpty()) throw IllegalStateException("manifest 缺少 sha256")

        onStatus("下载快照（" + (manifest.optLong("size", 0) / 1024 / 1024) + " MB）…")
        download(url, tmp)

        onStatus("校验…")
        val actual = sha256(tmp)
        if (!actual.equals(expectedSha, ignoreCase = true)) {
          tmp.delete()
          throw IllegalStateException("SHA256 不匹配: " + actual.take(12) + "…")
        }

        onStatus("解压新快照…")
        // The archive holds a usr/ prefix; stage it OUTSIDE the live tree.
        deleteRecursively(stage)
        SnapshotExtractor.extract(
          tmp.inputStream(), manifest.optLong("size", 0), stage, { _, _ -> },
        )
        val newUsr = File(stage, "usr")
        if (!File(newUsr, "bin/node").exists()) throw IllegalStateException("新快照缺少 node")

        onStatus("切换运行时…")
        val usr = File(context.filesDir, "usr")
        val old = File(context.filesDir, "usr-old")
        deleteRecursively(old)
        if (usr.exists() && !usr.renameTo(old)) throw IllegalStateException("备份当前运行时失败")
        if (!newUsr.renameTo(usr)) {
          if (old.exists()) old.renameTo(usr)
          throw IllegalStateException("切换失败，已回滚旧运行时")
        }
        deleteRecursively(stage)
        deleteRecursively(old)

        // Kill the old engine process: the EngineService watchdog restarts
        // it from the NEW usr within seconds. 重置启动冷却，让新运行时立即
        // 拉起，而不是再等看门狗的 90s 冷却窗口。
        try {
          Runtime.getRuntime().exec(arrayOf("/system/bin/pkill", "-f", "bin.js")).waitFor()
        } catch (_: Throwable) {
        }
        EngineManager.lastStartAttemptAt = 0
        // 在线指纹写入独立文件：不污染内置指纹（否则下次启动 snapshotFresh
        // 判定不匹配 → 重解压内置快照，把在线更新覆盖回出厂）。在线运行时
        // 每次启动仍会重打运行时补丁，补丁能力不缺失。
        File(context.filesDir, ".online-fingerprint").writeText(expectedSha)
        onStatus("更新完成，引擎已自动重启")
      } catch (t: Throwable) {
        onStatus("更新失败：" + (t.message ?: t.javaClass.simpleName))
      } finally {
        // 失败/异常路径清残留，避免下次更新撞到半截文件/目录。
        try {
          tmp.delete()
          deleteRecursively(stage)
        } catch (_: Throwable) {
        }
      }
    }.start()
  }

  /**
   * Fetch manifest with a hard size cap (hostile/large manifest must not
   * OOM) and HTTPS-only redirect handling (HttpURLConnection 默认跟随
   * 重定向，可被降级到 http——必须逐跳校验)。
   */
  private fun fetch(url: String): String {
    var current = url
    var redirects = 0
    while (true) {
      val conn = URL(current).openConnection() as HttpURLConnection
      conn.instanceFollowRedirects = false
      conn.connectTimeout = 10_000
      conn.readTimeout = 30_000
      val code = conn.responseCode
      if (code in 300..399) {
        val loc = conn.getHeaderField("Location")
        conn.disconnect()
        if (loc == null || redirects >= 5) throw IllegalStateException("manifest 重定向失败")
        current = URL(URL(current), loc).toString()
        if (!current.startsWith("https://")) throw IllegalStateException("manifest 重定向目标必须是 HTTPS")
        redirects++
        continue
      }
      if (code != 200) throw IllegalStateException("manifest HTTP $code")
      try {
        val out = java.io.ByteArrayOutputStream()
        conn.inputStream.use { input ->
          val buf = ByteArray(64 * 1024)
          var total = 0L
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            total += n
            if (total > MAX_MANIFEST_BYTES) throw IllegalStateException("manifest 过大")
            out.write(buf, 0, n)
          }
        }
        return out.toString(Charsets.UTF_8.name())
      } finally {
        conn.disconnect()
      }
    }
  }

  private fun requireHttps(url: String, label: String) {
    val scheme = URL(url).protocol
    if (!scheme.equals("https", ignoreCase = true)) {
      throw IllegalStateException("$label 必须是 HTTPS: $url")
    }
  }

  private fun download(url: String, dest: File) {
    var current = url
    var redirects = 0
    while (true) {
      val conn = URL(current).openConnection() as HttpURLConnection
      conn.instanceFollowRedirects = false
      conn.connectTimeout = 10_000
      conn.readTimeout = 60_000
      val code = conn.responseCode
      if (code in 300..399) {
        val loc = conn.getHeaderField("Location")
        conn.disconnect()
        if (loc == null || redirects >= 5) throw IllegalStateException("下载重定向失败")
        current = URL(URL(current), loc).toString()
        if (!current.startsWith("https://")) throw IllegalStateException("下载重定向目标必须是 HTTPS")
        redirects++
        continue
      }
      if (code != 200) throw IllegalStateException("下载 HTTP $code")
      val declared = conn.contentLengthLong
      if (declared > MAX_SNAPSHOT_BYTES) throw IllegalStateException("快照过大")
      var written = 0L
      try {
        conn.inputStream.use { input ->
          dest.outputStream().use { out ->
            val buf = ByteArray(64 * 1024)
            while (true) {
              val n = input.read(buf)
              if (n < 0) break
              written += n
              if (written > MAX_SNAPSHOT_BYTES) throw IllegalStateException("快照超过 500MB 上限")
              out.write(buf, 0, n)
            }
          }
        }
      } finally {
        conn.disconnect()
      }
      return
    }
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buf = ByteArray(64 * 1024)
      var n = input.read(buf)
      while (n >= 0) {
        digest.update(buf, 0, n)
        n = input.read(buf)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun deleteRecursively(file: File) {
    if (!file.exists()) return
    file.walkBottomUp().forEach { it.delete() }
  }

  companion object {
    /** Emulator reaches the host loopback alias; production overrides via manifestUrl. */
    const val DEFAULT_MANIFEST_URL = "https://github.com/kelai141/dsh-mobile-apk/releases/latest/download/manifest.json"
    const val MAX_SNAPSHOT_BYTES = 500L * 1024 * 1024
    /** manifest 体积上限（64KB，防恶意/异常大 manifest OOM）。 */
    const val MAX_MANIFEST_BYTES = 64L * 1024
  }
}