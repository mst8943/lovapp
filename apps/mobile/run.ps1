param(
  [ValidateSet('edge', 'chrome', 'android')]
  [string]$Device = 'android'
)

Set-Location -LiteralPath $PSScriptRoot

$configuration = Join-Path $PSScriptRoot '../../.env.production.local'
if (-not (Test-Path -LiteralPath $configuration)) {
  throw 'Root .env.production.local was not found.'
}

$public = @{}
foreach ($line in Get-Content -LiteralPath $configuration -Encoding UTF8) {
  if ($line -match '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.*)$') {
    $public[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
if (-not $public['NEXT_PUBLIC_SUPABASE_URL'] -or -not $public['NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  throw 'The public Supabase URL or anon key is missing from root .env.production.local.'
}

function Get-AndroidDevice {
  try {
    $devices = ConvertFrom-Json -InputObject ((flutter devices --machine 2>$null) -join "`n")
    return $devices | Where-Object { $_.isSupported -and $_.targetPlatform -like 'android-*' } | Select-Object -First 1
  } catch {
    return $null
  }
}

$targetDevice = $Device
if ($Device -eq 'android') {
  $androidDevice = Get-AndroidDevice
  if (-not $androidDevice) {
    Write-Host 'Starting Android emulator...'
    & flutter emulators --launch codex-lovask
    for ($attempt = 0; $attempt -lt 30 -and -not $androidDevice; $attempt++) {
      Start-Sleep -Seconds 2
      $androidDevice = Get-AndroidDevice
    }
  }
  if (-not $androidDevice) { throw 'Android emulator did not become ready within 60 seconds.' }
  $targetDevice = $androidDevice.id
} else {
  Write-Warning 'Edge/Chrome is only a UI preview. Production login and registration are blocked by browser CORS on localhost.'
}

& flutter run -d $targetDevice "--dart-define=SUPABASE_URL=$($public['NEXT_PUBLIC_SUPABASE_URL'])" "--dart-define=SUPABASE_ANON_KEY=$($public['NEXT_PUBLIC_SUPABASE_ANON_KEY'])"
exit $LASTEXITCODE
