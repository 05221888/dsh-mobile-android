package com.dshmobile.shell

import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.UUID

/**
 * Shizuku 桥接 HTTP 服务器：监听 127.0.0.1:36527，为 dsh-android-control
 * 插件提供 shell 执行通道（与 railgun0325/dsh-phone 的 Shizuku 桥协议兼容）。
 *
 * 协议：
 *   POST /exec HTTP/1.1
 *   x-dsh-token: <token>
 *   x-dsh-cmd: <shell 命令>
 *   x-dsh-timeout-ms: <超时 ms>
 *   响应：{"ok":true,"exitCode":0,"stdout":"...","stderr":"..."}
 *
 * 鉴权 token 由 [token] 生成，写入快照 HOME 的 .dsh-bridge-token，
 * 插件通过 process.env.HOME + '/.dsh-bridge-token' 读取。
 */
class ShizukuBridgeServer(
  private val bridgeToken: String,
  private val homeDir: java.io.File,
) {
  private var server: ServerSocket? = null
  private var running = false
  private val executor = java.util.concurrent.Executors.newCachedThreadPool()

  companion object {
    private const val TAG = "dsh-bridge"
    const val BRIDGE_PORT = 36527
    const val TOKEN_FILE = ".dsh-bridge-token"
    /** 桥接 token 字符文件（供插件读取）。 */
    fun tokenFile(homeDir: java.io.File) = java.io.File(homeDir, TOKEN_FILE)
  }

  /** 启动桥接服务器（后台线程，不阻塞）。 */
  fun start() {
    if (running) return
    try {
      // 写入 token 文件（插件通过 $HOME/.dsh-bridge-token 读取）
      tokenFile(homeDir).writeText(bridgeToken)
      Log.i(TAG, "bridge token written to " + tokenFile(homeDir).absolutePath)

      val socket = ServerSocket(BRIDGE_PORT, 50, InetAddress.getByName("127.0.0.1"))
      server = socket
      running = true
      Log.i(TAG, "bridge server started on 127.0.0.1:$BRIDGE_PORT")

      Thread {
        while (running) {
          try {
            val client = socket.accept()
            executor.submit { handle(client) }
          } catch (_: SocketTimeoutException) {
            // 正常超时，继续等待
          } catch (e: Exception) {
            if (running) Log.w(TAG, "accept failed: " + e.message)
          }
        }
      }.apply { isDaemon = true }.start()
    } catch (e: Exception) {
      Log.e(TAG, "bridge server start failed", e)
    }
  }

  /** 停止桥接服务器。 */
  fun stop() {
    running = false
    try { server?.close() } catch (_: Exception) {}
    server = null
    executor.shutdown()
  }

  /** 处理单个 HTTP 请求（简化：只解析一行请求行 + 逐行头部，不依赖完整 HTTP 解析器）。 */
  private fun handle(client: Socket) {
    try {
      client.soTimeout = 15_000
      val reader = BufferedReader(InputStreamReader(client.getInputStream(), "UTF-8"))
      val writer = OutputStreamWriter(client.getOutputStream(), "UTF-8")

      // 读取请求行
      val requestLine = reader.readLine() ?: return
      val parts = requestLine.split(" ")
      if (parts.size < 3 || parts[0] != "POST" || !parts[1].endsWith("/exec")) {
        respond(writer, 404, "{\"ok\":false,\"error\":\"not found\"}")
        return
      }

      // 读取头部
      var token: String? = null
      var cmd: String? = null
      var timeoutMs = 30_000L
      var contentLength = 0
      while (true) {
        val line = reader.readLine() ?: break
        if (line.isEmpty()) break
        when {
          line.startsWith("x-dsh-token:", ignoreCase = true) -> token = line.substringAfter(':').trim()
          line.startsWith("x-dsh-cmd:", ignoreCase = true) -> cmd = line.substringAfter(':').trim()
          line.startsWith("x-dsh-timeout-ms:", ignoreCase = true) -> {
            timeoutMs = line.substringAfter(':').trim().toLongOrNull()?.coerceIn(1_000, 600_000) ?: 30_000L
          }
          line.startsWith("Content-Length:", ignoreCase = true) -> {
            contentLength = line.substringAfter(':').trim().toIntOrNull() ?: 0
          }
        }
      }

      // 验证 token
      if (token != bridgeToken) {
        respond(writer, 403, "{\"ok\":false,\"error\":\"invalid token\"}")
        return
      }
      if (cmd.isNullOrBlank()) {
        respond(writer, 400, "{\"ok\":false,\"error\":\"missing x-dsh-cmd\"}")
        return
      }

      // 读取 body（stdin 内容，插件可能传空）
      val body = if (contentLength > 0) {
        val buf = CharArray(contentLength.coerceAtMost(64 * 1024))
        val read = reader.read(buf, 0, buf.size)
        String(buf, 0, read.coerceAtLeast(0))
      } else ""

      // 通过 Shizuku shell 执行
      val result = try {
        ShizukuShellExecutor.exec(arrayOf("/system/bin/sh", "-c", cmd), timeoutMs, wantBinary = false)
      } catch (e: IllegalStateException) {
        org.json.JSONObject()
          .put("ok", false)
          .put("exitCode", -1)
          .put("stdout", "")
          .put("stderr", e.message ?: "Shizuku 执行失败")
      }

      // 通过 shell 写入 stdin（如果插件需要）
      // （dsh-android-control 插件目前不用 stdin body，所以忽略）

      respond(writer, 200, result.toString())
    } catch (e: Exception) {
      Log.w(TAG, "handle error: " + e.message)
      try {
        respond(java.io.OutputStreamWriter(client.getOutputStream(), "UTF-8"), 500,
          "{\"ok\":false,\"error\":\"" + e.message?.replace("\"", "'") + "\"}")
      } catch (_: Exception) {}
    } finally {
      try { client.close() } catch (_: Exception) {}
    }
  }

  private fun respond(writer: OutputStreamWriter, code: Int, body: String) {
    val resp = "HTTP/1.1 $code OK\r\nContent-Type: application/json\r\nContent-Length: ${body.toByteArray(Charsets.UTF_8).size}\r\nConnection: close\r\n\r\n$body"
    writer.write(resp)
    writer.flush()
  }
}