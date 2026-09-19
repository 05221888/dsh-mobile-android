# 每次 APK 发布后检查与更新

发新 APK 之后必须进行以下两步，否则「检查 App 更新」不会提示：

1. `scripts/gitee_release_apk.py` 已把「Create release + Upload asset」做完。<br>
   **但 manifest.json 和 apk-manifest.json 仍停在 master 旧内容**——不更新 → 手机端不会弹升级。

2. 更新这两个文件（都是仓库根目录，不是 release 附件）：
   - `manifest.json` —— 引擎快照相机 URL / sha256 / size（快照换了才改）
   - `apk-manifest.json` —— APK 新版本信息（任何一次 APK 升级都必须更新它）

## ⚠️ 2026-09-19：dsh-mobile-releases 附件配额已满（1 GB）

`apk-v0.15.14` 上传时 Gitee 直接拒绝：

```
{"message":"验证失败，文件大小已超出仓库附件上限：1 GB"}
```

该仓库已塞满 12 个 82MB 的 DSH-Mobile APK（0.15.0~0.15.11），**发新版前必须先腾空间**，
三条路（按推荐顺序）：

1. **换仓库发**（本次 v0.15.14 用的就是这条，不删任何旧东西）：
   ```powershell
   python scripts/gitee_release_any.py wushenghuang/dsh-mobile-android apk-v0.15.14 <apk> <notes.md>
   ```
   然后把 `apk-manifest.json` 的 `url` 指向新仓库的下载地址即可——App 的更新器只看
   manifest 里的 url，跨仓库照样能下载。
2. 删旧版本 release（`DELETE /repos/{owner}/{repo}/releases/{id}`，会连附件一起删）腾出 82MB/个。
   注意：Gitee API **不返回附件的 attach_file_id**，所以只能整个 release 删，删之前把 notes 留档。
3. 附件压成 `.apk.xz`（对已内嵌 xz 快照的 APK 收益很小，约 82MB → 78MB，基本不解决问题）。

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

## ⚠️ sha256 字段必须对应 url 指向的实际文件

- `url` = `.apk` → `sha256` = APK 文件的 SHA256
- `url` = `.apk.xz` → `sha256` = **xz 压缩包的 SHA256**（手机端 UpdateManager 直接对下载下来的文件校验，不会自动解压）

代码证据：`UpdateManager.kt` L43-54 `downloadApk()`：

```kotlin
download(update.url, dest)        // dest 就是下载的原文件
val actual = sha256(dest)
if (!actual.equals(update.sha256, ignoreCase = true)) {
  throw IllegalStateException("APK SHA256 不匹配")
}
```

**Gitee 单附件上限 100MB**——APK > 100MB 时必须先 `xz` 压缩（128MB → 78MB），url 改 `.apk.xz`，sha256 必须算 xz 包：

```powershell
$apkSha = (Get-FileHash 'DSH-Mobile-0.15.0-debug.apk' -Algorithm SHA256).Hash.ToLower()
$xzSha  = (Get-FileHash 'DSH-Mobile-0.15.0-debug.apk.xz' -Algorithm SHA256).Hash.ToLower()
# 用 xzSha 写进 manifest 的 sha256 字段
```

实战坑：v0.15.0 发布时 url 已是 `.apk.xz`，但 manifest 的 sha256 误填了 APK 解压后的值 → 手机端 UpdateManager 直接报「APK SHA256 不匹配」。**sha256 与 url 必须同时指向同一文件**。

## 快照 manifest（manifest.json）小贴士

只在换快照 tar.xz 后才更新它；不重发 apk 只是改 manifest 的话，发动即可，不用动 App。
