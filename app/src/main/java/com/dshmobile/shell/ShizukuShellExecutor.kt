package com.dshmobile.shell

import android.content.pm.PackageManager
import android.util.Log
import java.io.ByteArrayOutputStream
import java.lang.reflect.Method
import java.util.concurrent.TimeUnit
import rikka.shizuku.Shizuku

/**
 * 通过反射调用 shizuku-api 13.1.5 的私有方法 [Shizuku.newProcess] 获得
 * shell uid (2000) 特权进程，执行一次性设备自动化命令（screencap /
 * uiautomator / input / am 等）。依据 dphmoblie/deepseek-harness-android
 * 的 ReflectiveShellExecutor 方案（MIT）：
 * `Shizuku.newProcess` 在 13.1.5 中存在但是私有，且 13.2.0 不在 Maven
 * Central；依赖固定 13.1.5 并冻结反射签名。若上游未来公开 newProcess，
 * 改为直接调用即可，签名不变。
 *
 * fail-closed：Shizuku 不可用 / 未授权 / 反射失败一律抛异常，绝不静默空转。
 */
object ShizukuShellExecutor {

  private const val TAG = "dsh-shizuku-exec"

  /** 单次执行文本输出上限（stdout 或 stderr）。 */
  private const val MAX_TEXT_BYTES = 256 * 1024

  /** 单次执行二进制输出上限（如 screencap PNG）。 */
  private const val MAX_BINARY_BYTES = 8 * 1024 * 1024

  private class ExecResult(
    val exitCode: Int,
    val stdoutText: String,
    val stderrText: String,
    val stdoutBase64: String?,
    val truncated: Boolean,
  )

  /** 缓存私有 Shizuku.newProcess 反射句柄，避免重复 getDeclaredMethod。 */
  @Volatile
  private var newProcessMethod: Method? = null

  /** True when the Shizuku server binder is reachable and authorized. */
  fun isAvailable(): Boolean {
    return try {
      Shizuku.pingBinder() && Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
    } catch (_: Throwable) {
      false
    }
  }

  /** 反射拿 Shizuku.newProcess(String[], String[], File) 回调。 */
  private fun newProcessMethod(): Method {
    newProcessMethod?.let { return it }
    val m = Shizuku::class.java.getDeclaredMethod("newProcess", Array<String>::class.java, Array<String>::class.java, java.io.File::class.java)
    m.isAccessible = true
    newProcessMethod = m
    return m
  }

  /**
   * 执行一条命令。
   * @param cmd argv（如 ["screencap", "-p", path]，无需经 shell）。
   * @param timeoutMs 超时。
   * @param wantBinary true = 二进制输出（截图），false = 文本输出。
   * @return JSONObject {ok, exitCode, stdout?, stderr?, base64?, truncated?}
   * @throws IllegalStateException Shizuku 不可用 / 超时 / 执行失败（fail-closed）。
   */
  fun exec(cmd: Array<String>, timeoutMs: Long, wantBinary: Boolean): org.json.JSONObject {
    if (!isAvailable()) {
      throw IllegalStateException("Shizuku 未运行或未授权（需先在设置中授权）")
    }
    val env = arrayOf("PATH=/system/bin:/system/xbin:/sbin:/vendor/bin")
    val process: Process = try {
      newProcessMethod().invoke(null, cmd, env, null) as Process
    } catch (error: Throwable) {
      throw IllegalStateException("无法创建 Shizuku 特权进程: " + error.message, error)
    }
    val result = drain(process, timeoutMs, wantBinary)
    return org.json.JSONObject()
      .put("ok", result.exitCode == 0)
      .put("exitCode", result.exitCode)
      .put("stdout", result.stdoutText)
      .put("stderr", result.stderrText)
      .apply { if (result.stdoutBase64 != null) put("base64", result.stdoutBase64) }
      .put("truncated", result.truncated)
  }

  /** 并发排空 stdout/stderr（防管道写满阻塞死锁），等待退出并返回结果。 */
  private fun drain(process: Process, timeoutMs: Long, wantBinary: Boolean): ExecResult {
    val outBuf = ByteArrayOutputStream()
    val errBuf = ByteArrayOutputStream()
    val outCapped = booleanArrayOf(false)
    val outThread = Thread {
      outCapped[0] = drainStream(process.inputStream, outBuf, if (wantBinary) MAX_BINARY_BYTES else MAX_TEXT_BYTES)
    }
    val errThread = Thread { drainStream(process.errorStream, errBuf, MAX_TEXT_BYTES) }
    outThread.start()
    errThread.start()
    val exited = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS)
    if (!exited) {
      process.destroy()
      process.destroyForcibly()
      throw IllegalStateException("特权命令执行超时（${timeoutMs}ms）")
    }
    outThread.join(2_000)
    errThread.join(2_000)
    val code = process.exitValue()
    return if (wantBinary) {
      ExecResult(
        exitCode = code,
        stdoutText = "",
        stderrText = errBuf.toString("UTF-8"),
        stdoutBase64 = android.util.Base64.encodeToString(outBuf.toByteArray(), android.util.Base64.NO_WRAP),
        truncated = outCapped[0],
      )
    } else {
      ExecResult(
        exitCode = code,
        stdoutText = outBuf.toString("UTF-8"),
        stderrText = errBuf.toString("UTF-8"),
        stdoutBase64 = null,
        truncated = outCapped[0],
      )
    }
  }

  /** 拷贝流直到 EOF 或达到上限；返回是否截断。 */
  private fun drainStream(input: java.io.InputStream, out: ByteArrayOutputStream, maxBytes: Int): Boolean {
    var capped = false
    try {
      val buf = ByteArray(16 * 1024)
      while (true) {
        val n = input.read(buf)
        if (n < 0) break
        if (out.size() + n > maxBytes) {
          out.write(buf, 0, maxBytes - out.size())
          capped = true
          // 继续读到 EOF 以释放子进程（不写入）
          val sink = ByteArray(16 * 1024)
          while (input.read(sink) >= 0) { /* drain */ }
          break
        }
        out.write(buf, 0, n)
      }
    } catch (_: Throwable) {
      // 流关闭/中断无害
    }
    return capped
  }
}