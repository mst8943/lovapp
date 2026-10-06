# Lovask web + Android release from a Windows PC (OpenSSH is built into Windows 10+).
#   powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy-release.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy-release.ps1 -SkipApk
# Ships only the files changed since -Base, so live-only server edits are left untouched.
param(
  [string]$Server = 'root@129.121.139.23',
  [string]$Base = '37a2539',
  [switch]$SkipApk
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$label = 'audit-' + (Get-Date -Format 'yyyyMMdd-HHmm')

foreach ($tool in 'git', 'npm', 'tar', 'ssh', 'scp') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "$tool bulunamadi. ssh/scp icin: Ayarlar > Uygulamalar > Istege bagli ozellikler > OpenSSH Istemcisi."
  }
}

if (git status --porcelain --untracked-files=no) { throw 'Commit edilmemis degisiklik var; once commit edin.' }

Write-Host '==> Web kontrolleri (lint, typecheck, build)'
if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci basarisiz.' }
}
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'npm run verify basarisiz; yayin yapilmadi.' }

$files = @(git diff --name-only --diff-filter=ACMR "$Base..HEAD" |
  Where-Object { $_ -notmatch '^apps/' -and $_ -notmatch '\.md$' -and $_ -notmatch '^scripts/deploy/' })

if (-not $SkipApk) {
  Write-Host '==> Android APK derleniyor ve imzalaniyor'
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'apps\mobile\build-release.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'APK derleme/imzalama basarisiz; yayin yapilmadi.' }
  $hash = (Get-FileHash -Algorithm SHA256 (Join-Path $repo 'public\lovask.apk')).Hash
  Write-Host "APK SHA-256: $hash"
  $files += 'public/lovask.apk'
} else {
  # Download links already advertise the new version; keep them with the APK they describe.
  $files = @($files | Where-Object { $_ -notin @('app/api/download/android/route.ts', 'app/download/page.tsx', 'components/landing-page.tsx') })
}

if (-not $files.Count) { throw 'Gonderilecek dosya yok.' }
Write-Host '==> Gonderilecek dosyalar'
$files | ForEach-Object { Write-Host "  - $_" }

$archive = Join-Path ([System.IO.Path]::GetTempPath()) "lovask-$label.tgz"
tar -czf $archive @files
if ($LASTEXITCODE -ne 0) { throw 'Arsiv olusturulamadi.' }

Write-Host "==> Sunucuya yukleniyor ($Server) - sifre sorulursa girin"
scp $archive "${Server}:/tmp/lovask-$label.tgz"
if ($LASTEXITCODE -ne 0) { throw 'Arsiv yuklenemedi.' }
scp (Join-Path $PSScriptRoot 'remote-deploy.sh') "${Server}:/tmp/lovask-remote-deploy.sh"
if ($LASTEXITCODE -ne 0) { throw 'Yayin betigi yuklenemedi.' }

Write-Host '==> Sunucuda asama derlemesi ve yayin'
ssh $Server "sed -i 's/\r$//' /tmp/lovask-remote-deploy.sh && bash /tmp/lovask-remote-deploy.sh /tmp/lovask-$label.tgz $label"
if ($LASTEXITCODE -ne 0) { throw 'Sunucu yayini basarisiz (ciktiya bakin; canli ya hic degismedi ya da geri donduruldu).' }

Write-Host "`nYayin tamam. Etiket: $label"
