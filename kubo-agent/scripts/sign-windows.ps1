# Authenticode signing for the KUBO Local Agent (Windows).
#
# Requirements:
#   - Windows SDK (signtool.exe)
#   - An OV or EV code signing certificate.
#       OV  -> .pfx file + password (env: KUBO_CERT_PATH, KUBO_CERT_PASSWORD)
#       EV  -> hardware token / cloud HSM; use the /n subject-name flow instead.
#
# Usage:
#   pwsh scripts/sign-windows.ps1 -Binary target\release\kubo-agent.exe

param(
  [Parameter(Mandatory = $true)][string]$Binary,
  [string]$TimestampUrl = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe |
  Where-Object { $_.FullName -like "*x64*" } | Select-Object -First 1
if (-not $signtool) { throw "signtool.exe not found. Install the Windows 10/11 SDK." }

if ($env:KUBO_CERT_PATH) {
  # OV certificate stored as a .pfx
  & $signtool.FullName sign `
    /f $env:KUBO_CERT_PATH `
    /p $env:KUBO_CERT_PASSWORD `
    /fd SHA256 /tr $TimestampUrl /td SHA256 `
    /d "KUBO Local Agent" /du "https://kubovibe.dev" `
    $Binary
} else {
  # EV certificate held in the Windows cert store / hardware token
  & $signtool.FullName sign `
    /n "KUBO PROTOCOL" /a `
    /fd SHA256 /tr $TimestampUrl /td SHA256 `
    /d "KUBO Local Agent" /du "https://kubovibe.dev" `
    $Binary
}

& $signtool.FullName verify /pa /v $Binary
Write-Host "Signed and verified: $Binary"
