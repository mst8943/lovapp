$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $repo 'apps\mobile'
$apk = Join-Path $mobile 'build\app\outputs\flutter-apk\app-release.apk'
$releaseDir = Join-Path $repo 'artifacts\release'
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$signed = Join-Path $releaseDir 'lovask.apk'
$candidate = Join-Path $releaseDir 'lovask.apk.new'
$public = @{}
Get-Content (Join-Path $repo '.env.production.local') | ForEach-Object {
  if ($_ -match '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.*)$') {
    $public[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
if (-not $public['NEXT_PUBLIC_SUPABASE_URL'] -or -not $public['NEXT_PUBLIC_SUPABASE_ANON_KEY']) { throw 'Mobil bağlantı ayarları eksik.' }
Push-Location $mobile
try {
  & C:\flutter\bin\flutter.bat build apk --release --no-pub `
    "--dart-define=SUPABASE_URL=$($public['NEXT_PUBLIC_SUPABASE_URL'])" `
    "--dart-define=SUPABASE_ANON_KEY=$($public['NEXT_PUBLIC_SUPABASE_ANON_KEY'])" `
    "--dart-define=LOVASK_API_URL=https://lovask.com.tr"
  if ($LASTEXITCODE -ne 0) { throw 'Flutter APK derlemesi başarısız oldu.' }
} finally {
  Pop-Location
}
& (Join-Path $repo 'artifacts\android-twa\sign-release.ps1') -InputApk $apk -OutputApk $candidate
if ($LASTEXITCODE -ne 0) { throw 'Lovask release imzası uygulanamadı.' }
$certificate = & (Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools\36.1.0\apksigner.bat') verify --print-certs $candidate
if ($LASTEXITCODE -ne 0 -or -not ($certificate -match '33c6ab7bc340355404e0a90f416cc8b467339dce215298131d684219e600e4e2')) {
  throw 'APK eski Lovask sertifikasıyla imzalanmadı.'
}
Move-Item -LiteralPath $candidate -Destination $signed -Force
Get-FileHash -Algorithm SHA256 -LiteralPath $signed | Select-Object Path, Hash
