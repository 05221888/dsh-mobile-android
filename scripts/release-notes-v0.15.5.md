v0.15.5 修复「检查 App 更新失败：Input is not in the xz format」。应用内更新此前无条件把下载文件当 xz 解压，而 0.15.x 发布的是裸 .apk。现按魔数识别 ZIP/XZ：是 APK 直接安装，是 xz 才解压。覆盖安装本包后，应用内更新可正常工作。
