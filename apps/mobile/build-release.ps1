$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$public = @{}
Get-Content (Join-Path $repo '.env.production.local') | ForEach-Object {
  if ($_ -match '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.*)$') {
    $public[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
if (-not $public['NEXT_PUBLIC_SUPABASE_URL'] -or -not $public['NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  throw 'Supabase public settings are missing.'
}

Push-Location $PSScriptRoot
try {
  & C:\flutter\bin\flutter.bat build apk --release --no-pub `
    "--dart-define=SUPABASE_URL=$($public['NEXT_PUBLIC_SUPABASE_URL'])" `
    "--dart-define=SUPABASE_ANON_KEY=$($public['NEXT_PUBLIC_SUPABASE_ANON_KEY'])"
  if ($LASTEXITCODE -ne 0) { throw 'Flutter APK build failed.' }
} finally {
  Pop-Location
}

$unsigned = Join-Path $PSScriptRoot 'build\app\outputs\flutter-apk\app-release.apk'
$signed = Join-Path $repo 'tmp\lovask-release-signed.apk'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'artifacts\android-twa\sign-release.ps1') -InputApk $unsigned -OutputApk $signed
if ($LASTEXITCODE -ne 0) { throw 'Lovask release signing failed.' }
Copy-Item -LiteralPath $signed -Destination (Join-Path $repo 'public\lovask.apk') -Force
