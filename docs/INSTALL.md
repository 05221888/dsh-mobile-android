# dsh-mobile-apk 使用手册

> 版本 v0.12.0-shizuku · 2026-08-19

## 快速开始

### 安装

1. 下载 APK（D 盘桌面 `DSH-Mobile-0.12.0-shizuku-debug.apk` 或 [Gitee Releases](https://gitee.com/wushenghuang/dsh-mobile-android/releases)）
2. 卸载旧版 → 安装新版
3. 打开 App

### 首次配置

**第一步：配置模型服务（中转站 API）**

首次启动后，App 会显示引导页。先配模型：

1. 等引擎启动 → 进入 DSH 对话界面
2. 点右上角设置 → 模型/Provider
3. 添加中转站 Provider（baseURL、API Key 直接填明文）
4. 选默认模型（如 `deepseek-v4-flash-0731`）
5. 回到对话，发消息测试

**第二步：授权 Shizuku（可选，用于操控手机）**

让 AI 帮你打开微信、截图、点击屏幕需要 Shizuku 授权：

1. 在引导页点「Shizuku 授权」按钮
2. 如果未安装 Shizuku App → 自动打开下载页
3. 安装 Shizuku → 打开 → 按引导完成授权（开发者选项 → 无线调试 → 配对码）
4. 回到本 App → 重启引擎（Shizuku 授权后生效）
5. 引导页状态栏显示 ✅ Shizuku 已授权

**第三步：开始使用**

让 AI 帮你做事：

| 你想做的 | 可以这样说 |
|----------|-----------|
| 看屏幕 | 「截图看看」 |
| 打开应用 | 「打开微信，搜索 XX 公众号」 |
| 点屏幕 | 「点屏幕坐标 (540, 1200)」 |
| 执行命令 | 「用 android_shell 执行 `pm list packages`」 |
| 查看状态 | 「查一下手机状态」 |

## 什么是 Shizuku

Shizuku 是一个 Android 开源工具，让普通应用获得 `adb shell` 级别的能力（无需 root）。本 APK 通过 Shizuku 桥接，让 AI 代理可以执行：

- 截图（`screencap`）
- 点击/滑动（`input tap/swipe`）
- 打开应用（`am start`）
- 查看 UI 层级（`uiautomator`）
- 安装 APK、执行 shell 命令

**不装 Shizuku 也能用**：只是 AI 无法操控手机屏幕和应用。对话、模型调用、知识问答等基础功能不受影响。

## 引导页说明

引导页（引擎未运行时可见）提供：

- **引擎状态**：实时显示引擎运行状态
- **Shizuku 状态**：已授权/未授权提示
- **首次使用引导**：首次启动时显示步骤指导
- **按钮**：
  - 打开控制台（bash 终端，排查用）
  - 重试（重启引擎）
  - 打开 Termux（如果已安装）
  - 检查运行时更新（在线更新快照）
  - Shizuku 授权（安装/打开 Shizuku）

## 常见问题

**Q: 引擎一直重试，模型调用失败？**
A: 需要手动配置中转站 API。参考上方「首次配置」第一步。

**Q: 截图/打开微信失败？**
A: 需要安装 Shizuku 并授权本应用。参考上方「第二步」。

**Q: 安装后白屏？**
A: 首次启动需要解压约 70MB 运行时快照，等待 10-30 秒。如果持续白屏，回到引导页查看引擎状态。

**Q: 如何更新？**
A: 安装新 APK 即可（覆盖安装，用户数据保留）。或者使用引导页「检查运行时更新」在线更新快照。

**Q: 怎么删除会话？**
A: 会话列表 → 点垃圾桶图标（dsh-plugin-session-delete 插件提供）。

## 插件清单

本 APK 内置以下额外插件（桌面版移植）：

| 插件 | 功能 |
|------|------|
| `dsh-android-control` | 28 个安卓控制工具（截图/点击/打开应用等） |
| `dsh-notify-sound` | 操作反馈音效 |
| `dsh-plugin-session-delete` | 永久删除会话 |
| `@dsh-external/dsh-model-failover` | 模型故障自动切换 provider |

## 技术架构

```
┌─────────────────────────────────┐
│         MainActivity            │
│  (WebView + GuideView + 桥)     │
├─────────────────────────────────┤
│  EngineManager (snapshot 引擎)   │
│  └─ shellEnv(): LD_PRELOAD/TERM │
├─────────────────────────────────┤
│  ShizukuBridgeServer (36527)    │
│  └─ ReflectiveShellExecutor     │
│     └─ Shizuku.newProcess       │
├─────────────────────────────────┤
│  dsh-android-control 插件       │
│  └─ 28 个 android_* 工具        │
│     └─ su → Shizuku 桥 → 报错   │
└─────────────────────────────────┘
```

## 构建方法

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat --offline assembleDebug
# 产物: app/build/outputs/apk/debug/app-debug.apk
```

要求：JDK 17+、Android SDK（compileSdk 36）、Gradle 8.11.1（由 wrapper 提供）、运行时快照 `app/src/main/assets/snapshot.tar.xz`（约 70MB）。