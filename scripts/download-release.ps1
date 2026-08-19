# Download the official arm64 APK and runtime snapshot via gh-proxy.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$assets = Join-Path $root 'app\src\main\assets'
New-Item -ItemType Directory -Force $dist | Out-Null
New-Item -ItemType Directory -Force $assets | Out-Null

$apkUrl = 'https://gh-proxy.com/https://github.com/kelai141/dsh-mobile-apk/releases/download/v0.11.3/dsh-mobile-apk-v0.11.3-arm64-v8a.apk'
$snapUrl = 'https://gh-proxy.com/https://github.com/kelai141/dsh-mobile-apk/releases/download/v0.11.3/snapshot-arm64.tar.xz'
$apk = Join-Path $dist 'dsh-mobile-v0.11.3-arm64-v8a.apk'
$snap = Join-Path $assets 'snapshot.tar.xz'

Write-Host "Downloading APK..."
& curl.exe -L --retry 8 --retry-all-errors -C - --connect-timeout 20 -o $apk $apkUrl
Write-Host "Downloading snapshot..."
& curl.exe -L --retry 8 --retry-all-errors -C - --connect-timeout 20 -o $snap $snapUrl
Get-Item $apk, $snap | Format-Table Name, Length
