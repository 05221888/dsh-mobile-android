package com.dshmobile.shell

import android.content.Context
import android.util.Log
import rikka.shizuku.ShizukuProvider

/**
 * Shizuku 能力统一管理：
 * - 授权引导（shizuku 授权需 adb 或 root，见 ShizukuShellExecutor）；
 * - 桥接 token 生成（进程级共享，MainActivity/EngineService 双实例复用）；
 * - 桥接服务器启停（Shizuku 可用且已授权时启动，供 dsh-android-control 插件使用）。
 */
object ShizukuManager {

  private const val TAG = "dsh-shizuku"

  /** 进程级共享桥接 token（首次生成后复用）。 */
  @Volatile
  private var sharedToken: String? = null

  /** 进程级桥接服务器单例（EngineService 看门狗重启引擎时复用，防重复 bind）。 */
  @Volatile
  private var bridgeServer: ShizukuBridgeServer? = null

  /** 获取（或首次生成）桥接 token；引擎 env 的 DSH_BRIDGE_TOKEN 保持一致。 */
  fun ensureToken(): String {
    sharedToken?.let { return it }
    val token = java.util.UUID.randomUUID().toString()
    sharedToken = token
    return token
  }

  /** 当前是否可用（Shizuku 绑定 + 已授权）。 */
  fun isAvailable(): Boolean = ShizukuShellExecutor.isAvailable()

  /**
   * 确保桥接 token 文件已写 + 服务器运行（引擎启动后由 EngineManager 调用）。
   * token 文件总是写（幂等，插件在加载时读取）；Shizuku 已授权时才启动
   * HTTP 服务器，否则跳过——插件会回退 su 通道或返回明确错误。单例：
   * 引擎多次启动（看门狗）不会重复 bind 端口。
   */
  fun ensureBridgeRunning(context: Context) {
    // token 文件总是写（幂等）：插件通过 $HOME/.dsh-bridge-token 读取。
    try {
      val home = java.io.File(context.filesDir, "home")
      val tokenFile = ShizukuBridgeServer.tokenFile(home)
      if (!tokenFile.exists()) tokenFile.writeText(ensureToken())
      else if (sharedToken == null) sharedToken = tokenFile.readText().trim()
      Log.i(TAG, "bridge token file ready: " + tokenFile.absolutePath)
    } catch (t: Throwable) {
      Log.e(TAG, "token file write failed", t)
    }
    if (!ShizukuShellExecutor.isAvailable()) {
      Log.i(TAG, "Shizuku 不可用，跳过桥接服务器启动（插件将回退 su / 报错）")
      return
    }
    try {
      if (bridgeServer != null) {
        Log.i(TAG, "Shizuku bridge already running (singleton)")
        return
      }
      val home = java.io.File(context.filesDir, "home")
      val server = ShizukuBridgeServer(ensureToken(), home)
      server.start()
      bridgeServer = server
      Log.i(TAG, "Shizuku bridge running (port " + ShizukuBridgeServer.BRIDGE_PORT + ")")
    } catch (t: Throwable) {
      Log.e(TAG, "bridge start failed", t)
    }
  }

  /** 引擎环境变量：把桥接 token 注入引擎进程（环境内可读，便于插件/工具访问）。 */
  fun envInject(): Map<String, String> = mapOf(
    "DSH_BRIDGE_TOKEN" to ensureToken(),
    "DSH_BRIDGE_PORT" to ShizukuBridgeServer.BRIDGE_PORT.toString(),
  )
}