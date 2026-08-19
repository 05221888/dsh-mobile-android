# DSH 手机版（本机运行）使用说明

这是一版可在 Android 上本地运行 DeepSeek Harness 的 App。基线是 [kelai141/dsh-mobile-apk v0.11.3](https://github.com/kelai141/dsh-mobile-apk)，本仓库补了安全、更新校验和旧 WebView 兼容。

## 现在就能用

本机直连 GitHub Releases 大文件会被墙。请用手机浏览器下载官方已发布的 arm64 包：

https://github.com/kelai141/dsh-mobile-apk/releases/tag/v0.11.3

文件名：`dsh-mobile-apk-v0.11.3-arm64-v8a.apk`

如果电脑能开迷雾通，也可以用：

```powershell
cd C:\Users\五五\Desktop\项目\dsh-mobile-android
powershell -File scripts\download-release.ps1
```

然后：

1. 把 APK 传到手机并安装。
2. 打开 App，首次启动会解压内嵌 Runtime（约 70MB，大约 10 秒）。
3. 等待进入 DSH Web 界面后，按引导填写 API Key。
4. 需要读写手机目录时，在工作区选择器里授权目录。
5. 需要后台保活时，把本应用加入电池优化白名单。

要求：

- Android 8+（minSdk 26）
- arm64 真机（骁龙 845 / MIX 2S 属于 arm64，可装；8GB 内存会比较吃力）
- 系统 WebView 尽量升级到较新版本

## 本仓库相对上游补了什么

- 明文流量只允许 `127.0.0.1` / `localhost`
- 关闭 `allowBackup`，避免备份导出 API Key
- 运行时更新必须 HTTPS，且必须校验 SHA-256
- 更新切换失败会回滚旧 Runtime
- 解压快照时拒绝路径穿越和绝对符号链接
- `ACTION_UPDATE` 只在 debug 包生效
- 页面开始加载时注入 `AbortSignal.any` / `crypto.randomUUID` 等 polyfill

## 远程电脑模式

这一版先交付「手机本地运行」。远程控制电脑 DSH 已预留为下一阶段：

- 反代 + Host/Origin 改写
- QR + 一次性邀请码
- 每设备 ACL

不要把 DSH 直接绑到 `0.0.0.0`。

## 自己构建

```powershell
# 需要 JDK 17 + Android SDK
# 本机已写 local.properties: sdk.dir=D:\Android\Sdk

# 1. 放入 arm64 运行时快照
#    从 https://github.com/kelai141/dsh-mobile-apk/releases/tag/v0.11.3
#    下载 snapshot-arm64.tar.xz
#    放到 app\src\main\assets\snapshot.tar.xz

# 2. 构建
cd dsh-mobile-android
.\gradlew.bat assembleDebug
```

产物：

```text
app\build\outputs\apk\debug\app-debug.apk
```
