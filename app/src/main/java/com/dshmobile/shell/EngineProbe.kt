package com.dshmobile.shell

import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/** Probes the local dsh web engine (127.0.0.1:3080) from the shell side. */
object EngineProbe {

  const val ENGINE_URL = "http://127.0.0.1:3080"

  /**
   * One-shot reachability probe. Safe on any thread (never the main thread).
   * @param timeoutMs connect+read budget per attempt.
   * @returns JSON: {running: Boolean, latencyMs: Int, error?: String}
   */
  fun check(timeoutMs: Int = 800): JSONObject {
    return try {
      val conn = URL(ENGINE_URL).openConnection() as HttpURLConnection
      conn.connectTimeout = timeoutMs
      conn.readTimeout = timeoutMs
      conn.requestMethod = "GET"
      conn.instanceFollowRedirects = false
      val start = System.currentTimeMillis()
      // 任意 HTTP 响应都算「引擎在」：dsh 启动中/未登录可能是 401/404/503/302。
      // 只认 200 会把「进程活着但还在 boot」误判成死引擎，触发冷却假死。
      val code = conn.responseCode
      conn.disconnect()
      JSONObject()
        .put("running", true)
        .put("code", code)
        .put("latencyMs", System.currentTimeMillis() - start)
    } catch (e: Exception) {
      JSONObject().put("running", false).put("error", e.message ?: "unknown")
    }
  }
}
