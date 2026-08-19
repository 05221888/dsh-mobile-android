package com.dshmobile.shell

import android.content.Context
import android.util.Log
import androidx.annotation.MainThread
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
   * 主线程调用：确保桥接 token 文件已写 + 服务器运行（引擎启动后由
   * EngineManager 调用）。token 文件先写（插件始终能读到，仅本地环回
   * 用）；Shizuku 已授权时才启动 HTTP 服务器，否则跳过——插件会回退
   * su 通道或返回明确错误。
   */
  @MainThread
  fun ensureBridgeRunning(context: Context) {
    // token 文件总是写（幂等）：插件在加载时读取；授权后重启引擎即生效。
    try {
      val home = java.io.File(context.filesDir, "home")
      val tokenFile = ShizukuBridgeServer.tokenFile(home)
      if (!tokenFile.exists()) tokenFile.writeText(ensureToken())
      Log.i(TAG, "bridge token file ready: " + tokenFile.absolutePath)
    } catch (t: Throwable) {
      Log.e(TAG, "token file write failed", t)
    }
    if (!ShizukuShellExecutor.isAvailable()) {
      Log.i(TAG, "Shizuku 不可用，跳过桥接服务器启动（插件将回退 su / 报错）")
      return
    }
    try {
      val home = java.io.File(context.filesDir, "home")
      val server = ShizukuBridgeServer(ensureToken(), home)
      server.start()
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