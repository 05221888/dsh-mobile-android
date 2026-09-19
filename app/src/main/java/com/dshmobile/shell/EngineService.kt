package com.dshmobile.shell

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Foreground service owning the embedded engine lifecycle: keeps the app
 * process alive while backgrounded (user-visible notification) and restarts
 * the engine process when it dies (watchdog). M2 keep-alive, no root needed.
 */
class EngineService : Service() {

  private lateinit var engineManager: EngineManager
  private var watchdog: ScheduledExecutorService? = null

  override fun onCreate() {
    super.onCreate()
    // C1：复用进程级 pick token（看门狗重启引擎后鉴权不失效、不空放行）。
    engineManager = EngineManager(this, EngineManager.ensurePickToken())
    startForeground(NOTIFICATION_ID, buildNotification())
    // 开发者日志开关已开：常驻收集（logcat + engine.log → dshdata/log/ 按天）。
    if (MainActivity.DevLogPrefs.isEnabled(this)) LogCollector.start(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureEngine()
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    watchdog?.shutdownNow()
    watchdog = null
    // 服务退出即停止日志收集（进程内幂等单例；开关关时也已停）。
    LogCollector.stop()
    super.onDestroy()
  }

  /** Start the engine if not running, then arm the watchdog. */
  private fun ensureEngine() {
    if (EngineProbe.check().optBoolean("running", false)) {
      EngineManager.earlyCrashCount = 0
    } else if (engineManager.engineReady) {
      engineManager.startEngine()
    }
    // v0.15.13：看门狗与"这次是不是我启的引擎"解耦。
    // 旧逻辑是「引擎已在跑就 return」→ 正常启动路径（Activity 先把引擎拉起来，
    // 再 startForegroundService）永远装不上看门狗：后台引擎死了没人拉，
    // 通知却还写着"dsh 引擎运行中"。现在只要运行时在位就装上。
    armWatchdog()
  }

  /**
   * Watchdog: poll every 8s; if the engine is not answering, restart it.
   * 进程还在（正常启动窗口）时不清冷却——交给 startEngine 的 60s 宽限期判断，
   * 否则就是拿 5s/8s 的轮询去逼一次"杀重启"，真机 EADDRINUSE 的来源之一。
   */
  private fun armWatchdog() {
    if (!engineManager.engineReady || watchdog != null) return
    watchdog = Executors.newSingleThreadScheduledExecutor().also { exec ->
      exec.scheduleWithFixedDelay({
        try {
          if (engineManager.engineReady && !EngineProbe.check().optBoolean("running", false)) {
            val exited = engineManager.engineExited
            if (exited) EngineManager.lastStartAttemptAt = 0
            // 连崩时放慢节奏（早夭已清冷却，避免狂拉加重崩溃循环）。
            if (EngineManager.earlyCrashCount >= 2) Thread.sleep(7_000)
            Log.i(TAG, "watchdog: engine down (exited=" + exited + "), restarting")
            engineManager.startEngine()
          }
        } catch (t: Throwable) {
          Log.w(TAG, "watchdog tick failed", t)
        }
      }, 8, 8, TimeUnit.SECONDS)
    }
  }

  private fun buildNotification(): android.app.Notification {
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(NotificationChannel("engine", "dsh 引擎", NotificationManager.IMPORTANCE_LOW))
    }
    val pending = PendingIntent.getActivity(
      this, 0, Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, "engine")
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle("dsh 引擎运行中")
      .setContentText("DeepSeek Harness 正在后台工作")
      .setContentIntent(pending)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val TAG = "dsh-engine-svc"
    private const val NOTIFICATION_ID = 2
  }
}
