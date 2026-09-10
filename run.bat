@echo off
setlocal

set "APP_DIR=%~dp0"
set "PID_DIR=%APP_DIR%.runtime"

if not exist "%PID_DIR%" mkdir "%PID_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$root = (Resolve-Path '%APP_DIR%').Path;" ^
  "$pidDir = Join-Path $root '.runtime';" ^
  "$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress);" ^
  "if (!$lanIp) { $lanIp = 'localhost' }" ^
  "$env:FRONTEND_ORIGIN = 'https://localhost:8081,https://' + $lanIp + ':8081';" ^
  "$env:VITE_API_BASE_URL = 'https://' + $lanIp + ':8081/api';" ^
  "function Get-ListenerPid($port) {" ^
  "  $line = (& netstat.exe -ano | Select-String (':' + $port + '\s+.*LISTENING')) | Select-Object -First 1;" ^
  "  if (!$line) { return $null }" ^
  "  if ($line.Line -match '\s+(\d+)\s*$') { return [int]$Matches[1] }" ^
  "  return $null;" ^
  "}" ^
  "function Start-AppProcess($name, $port, $command) {" ^
  "  $existingPid = Get-ListenerPid $port;" ^
  "  if ($existingPid) {" ^
  "    Set-Content -Path (Join-Path $pidDir ($name + '.pid')) -Value $existingPid;" ^
  "    Write-Host ($name + ' is already running on port ' + $port + '. PID: ' + $existingPid);" ^
  "    return;" ^
  "  }" ^
  "  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/s', '/c', $command) -WorkingDirectory $root -WindowStyle Hidden | Out-Null;" ^
  "  Start-Sleep -Seconds 3;" ^
  "  $pidValue = Get-ListenerPid $port;" ^
  "  if ($pidValue) {" ^
  "    Set-Content -Path (Join-Path $pidDir ($name + '.pid')) -Value $pidValue;" ^
  "    Write-Host ($name + ' started on port ' + $port + '. PID: ' + $pidValue);" ^
  "  } else {" ^
  "    Write-Host ($name + ' is starting on port ' + $port + '. PID not available yet.');" ^
  "  }" ^
  "}" ^
  "Start-AppProcess 'api' 3001 'npm run dev:api';" ^
  "Start-AppProcess 'web' 8081 'npm run dev -- --port 8081';" ^
  "Write-Host ('LGU DocTrack local URL: https://localhost:8081');" ^
  "Write-Host ('LGU DocTrack network URL: https://' + $lanIp + ':8081');" ^
  "Write-Host ('API network URL (via HTTPS frontend): https://' + $lanIp + ':8081/api');"

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Failed to start LGU DocTrack. PowerShell exit code: %EXIT_CODE%
)

if /i not "%~1"=="/nopause" pause
endlocal & exit /b %EXIT_CODE%
