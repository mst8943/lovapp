# Lovask web + Android release from a Windows PC (OpenSSH is built into Windows 10+).
#   powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy-release.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy-release.ps1 -SkipApk
# Ships only the files changed since -Base, so live-only server edits are left untouched.
param(
  [string]$Server = 'root@129.121.139.23',
  [string]$Base = '31b5ef6',
  [switch]$SkipApk
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$label = 'audit-' + (Get-Date -Format 'yyyyMMdd-HHmm')

if (git status --porcelain --untracked-files=no) { throw 'Commit edilmemiş değişiklik var; önce commit edin.' }

Write-Host '==> Web kontrolleri (lint, typecheck, build)'
if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci başarısız.' }
}
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'npm run verify başarısız; yayın yapılmadı.' }

$files = @(git diff --name-only --diff-filter=ACMR "$Base..HEAD" |
  Where-Object { $_ -notmatch '^apps/' -and $_ -notmatch '\.md$' -and $_ -notmatch '^scripts/deploy/' })

if (-not $SkipApk) {
  Write-Host '==> Android APK derleniyor ve imzalanıyor'
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'apps\mobile\build-release.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'APK derleme/imzalama başarısız; yayın yapılmadı.' }
  $hash = (Get-FileHash -Algorithm SHA256 (Join-Path $repo 'public\lovask.apk')).Hash
  Write-Host "APK SHA-256: $hash"
  $files += 'public/lovask.apk'
} else {
  # Download links already advertise the new version; keep them with the APK they describe.
  $files = @($files | Where-Object { $_ -notin @('app/api/download/android/route.ts', 'app/download/page.tsx', 'components/landing-page.tsx') })
}

if (-not $files.Count) { throw 'Gönderilecek dosya yok.' }
Write-Host '==> Gönderilecek dosyalar'
$files | ForEach-Object { Write-Host "  · $_" }

$archive = Join-Path $env:TEMP "lovask-$label.tgz"
tar -czf $archive @files
if ($LASTEXITCODE -ne 0) { throw 'Arşiv oluşturulamadı.' }

Write-Host "==> Sunucuya yükleniyor ($Server) — şifre sorulursa girin"
scp $archive "${Server}:/tmp/lovask-$label.tgz"
if ($LASTEXITCODE -ne 0) { throw 'Arşiv yüklenemedi.' }
scp (Join-Path $PSScriptRoot 'remote-deploy.sh') "${Server}:/tmp/lovask-remote-deploy.sh"
if ($LASTEXITCODE -ne 0) { throw 'Yayın betiği yüklenemedi.' }

Write-Host '==> Sunucuda aşama derlemesi ve yayın'
ssh $Server "sed -i 's/\r$//' /tmp/lovask-remote-deploy.sh && bash /tmp/lovask-remote-deploy.sh /tmp/lovask-$label.tgz $label"
if ($LASTEXITCODE -ne 0) { throw 'Sunucu yayını başarısız (çıktıya bakın; canlı ya hiç değişmedi ya da geri döndürüldü).' }

Write-Host "`nYayın tamam. Etiket: $label"
