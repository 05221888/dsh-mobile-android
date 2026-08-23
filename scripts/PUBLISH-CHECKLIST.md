# 每次 APK 发布后检查与更新

发新 APK 之后必须进行以下两步，否则「检查 App 更新」不会提示：

1. `scripts/gitee_release_apk.py` 已把「Create release + Upload asset」做完。<br>
   **但 manifest.json 和 apk-manifest.json 仍停在 master 旧内容**——不更新 → 手机端不会弹升级。

2. 更新这两个文件（都是仓库根目录，不是 release 附件）：
   - `manifest.json` —— 引擎快照相机 URL / sha256 / size（快照换了才改）
   - `apk-manifest.json` —— APK 新版本信息（任何一次 APK 升级都必须更新它）

## 现在用什么发

```powershell
$token = ("protocol=https`nhost=gitee.com`n" | & git credential fill | Where-Object { $_ -match "^password=" }) -replace "^password=",""
$repo = "wushenghuang/dsh-mobile-releases"
```

## 快速更新（本次 v0.13.0 实例）

```powershell
$sha = (Get-FileHash "D:\Desktop\DSH-Mobile-0.13.0-debug.apk" -Algorithm SHA256).Hash.ToLower()

# manifest（spec：versionCode/versionName/url/sha256/notes）
$f = Invoke-RestMethod "https://gitee.com/api/v5/repos/$repo/contents/apk-manifest.json?ref=master&access_token=$token"
$body = @{
  access_token = $token
  content      = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content (Join-Path $PSScriptRoot 'apk-manifest.json') -Raw)))
  message      = "[update] v0.13.0"
  branch       = "master"
  sha          = $f.sha
} | ConvertTo-Json
Invoke-RestMethod "https://gitee.com/api/v5/repos/$repo/contents/apk-manifest.json" -Method Put -Body $body -ContentType "application/json"

# ♻️ verify: curl https://gitee.com/wushenghuang/dsh-mobile-releases/raw/master/apk-manifest.json
```

## APK manifest 结构

```json
{
  "versionCode": 28,
  "versionName": "0.13.0",
  "url": "https://gitee.com/wushenghuang/dsh-mobile-releases/releases/download/apk-v0.13.0/DSH-Mobile-0.13.0-debug.apk",
  "sha256": "<apk 文件 SHA256>",
  "notes": "<每次更新说明>"
}
```

更新条件：`versionCode` 必须 > 手机当前 versionCode。**只要版本号 +1**（哪怕只是 bugfix），手机才会看到升级。

## 快照 manifest（manifest.json）小贴士

只在换快照 tar.xz 后才更新它；不重发 apk 只是改 manifest 的话，发动即可，不用动 App。
