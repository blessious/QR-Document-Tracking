@echo off
setlocal

set "APP_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = (Resolve-Path '%APP_DIR%').Path;" ^
  "$pidDir = Join-Path $root '.runtime';" ^
  "function Get-ListenerPid($port) {" ^
  "  $line = (& netstat.exe -ano | Select-String (':' + $port + '\s+.*LISTENING')) | Select-Object -First 1;" ^
  "  if (!$line) { return $null }" ^
  "  if ($line.Line -match '\s+(\d+)\s*$') { return [int]$Matches[1] }" ^
  "  return $null;" ^
  "  }" ^
  "foreach ($target in @(@{Name='api';Port=3001}, @{Name='web';Port=8081})) {" ^
  "  $pidValue = Get-ListenerPid $target.Port;" ^
  "  if (!$pidValue -and (Test-Path $pidDir)) {" ^
  "    $pidFile = Join-Path $pidDir ($target.Name + '.pid');" ^
  "    if (Test-Path $pidFile) {" ^
  "      $pidText = (Get-Content $pidFile -Raw).Trim();" ^
  "      if ($pidText -match '^\d+$') { $pidValue = [int]$pidText }" ^
  "    }" ^
  "  }" ^
  "  if ($pidValue) {" ^
  "    & taskkill.exe /PID $pidValue /T /F | Out-Null;" ^
  "    if ($LASTEXITCODE -eq 0) {" ^
  "      Write-Host ($target.Name + ' stopped. PID: ' + $pidValue);" ^
  "    } else {" ^
  "      Write-Host ($target.Name + ' could not be stopped. PID: ' + $pidValue);" ^
  "    }" ^
  "  } else {" ^
  "    Write-Host ($target.Name + ' is not running on port ' + $target.Port + '.');" ^
  "  }" ^
  "  if (Test-Path $pidDir) {" ^
  "    Remove-Item -LiteralPath (Join-Path $pidDir ($target.Name + '.pid')) -Force -ErrorAction SilentlyContinue;" ^
  "  }" ^
  "}" ^
  "exit 0;"

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Failed to stop one or more LGU DocTrack processes. PowerShell exit code: %EXIT_CODE%
)

if /i not "%~1"=="/nopause" pause
endlocal & exit /b %EXIT_CODE%
