param(
    [string]$Adb = 'D:/devtools/android-sdk/platform-tools/adb.exe',
    [string]$Serial,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../artifacts/device')
)
$ErrorActionPreference = 'Stop'
$deviceLines = & $Adb devices
if ($LASTEXITCODE -ne 0) { throw 'adb devices failed' }
$devices = @($deviceLines | Select-String '^([^\s]+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value })
if (!$Serial) {
    if ($devices.Count -ne 1) { throw 'Connect exactly one authorized device or specify -Serial.' }
    $Serial = $devices[0]
}
if ($Serial -notin $devices) { throw 'Selected device is not connected and authorized.' }
$target = Join-Path $OutputDirectory (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $target -Force | Out-Null
function Save-Adb([string]$Name, [string[]]$Arguments) {
    $result = & $Adb -s $Serial @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Collection failed: $Name. Install and launch the debug PoC APK first. $result" }
    $result | Set-Content -LiteralPath (Join-Path $target $Name) -Encoding utf8
}
Save-Adb 'background-poc.jsonl' @('shell','run-as','com.nurox.musictestbed.backgroundpoc','cat','files/background-poc.jsonl')
Save-Adb 'battery.txt' @('shell','dumpsys','battery')
Save-Adb 'android-version.txt' @('shell','getprop','ro.build.version.release')
Save-Adb 'sdk.txt' @('shell','getprop','ro.build.version.sdk')
Save-Adb 'model.txt' @('shell','getprop','ro.product.model')
Write-Output "Saved device diagnostics: $target"
