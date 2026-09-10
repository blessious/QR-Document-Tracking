@echo off
setlocal

set "APP_DIR=%~dp0"
set "PID_DIR=%APP_DIR%.runtime"

if not exist "%PID_DIR%" mkdir "%PID_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$root = (Resolve-Path '%APP_DIR%').Path;" ^
  "$pidDir = Join-Path $root '.runtime';" ^
  "$certPath = Join-Path $root 'node_modules\.vite\basic-ssl\_cert.pem';" ^
  "$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress);" ^
  "if (!$lanIp) { $lanIp = 'localhost' }" ^
  "function Get-ListenerPid($port) {" ^
  "  $line = (& netstat.exe -ano | Select-String (':' + $port + '\s+.*LISTENING')) | Select-Object -First 1;" ^
  "  if (!$line) { return $null }" ^
  "  if ($line.Line -match '\s+(\d+)\s*$') { return [int]$Matches[1] }" ^
  "  return $null;" ^
  "}" ^
  "function Stop-Port($name, $port) {" ^
  "  $pidValue = Get-ListenerPid $port;" ^
  "  if (!$pidValue -and (Test-Path $pidDir)) {" ^
  "    $pidFile = Join-Path $pidDir ($name + '.pid');" ^
  "    if (Test-Path $pidFile) {" ^
  "      $pidText = (Get-Content $pidFile -Raw).Trim();" ^
  "      if ($pidText -match '^\d+$') { $pidValue = [int]$pidText }" ^
  "    }" ^
  "  }" ^
  "  if ($pidValue) {" ^
  "    & cmd.exe /d /c ('taskkill.exe /PID ' + $pidValue + ' /T /F >nul 2>&1') | Out-Null;" ^
  "    if ($LASTEXITCODE -eq 0) { Write-Host ($name + ' stopped. PID: ' + $pidValue); }" ^
  "    else { Write-Host ($name + ' was already stopped.'); }" ^
  "  } else {" ^
  "    Write-Host ($name + ' is not running on port ' + $port + '.');" ^
  "  }" ^
  "  Remove-Item -LiteralPath (Join-Path $pidDir ($name + '.pid')) -Force -ErrorAction SilentlyContinue;" ^
  "}" ^
  "function Stop-CommandTree($label, $pattern) {" ^
  "  $matchedProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -match $pattern } | Sort-Object ProcessId -Unique);" ^
  "  $matchedIds = @{};" ^
  "  foreach ($matchedProcess in $matchedProcesses) { $matchedIds[[int]$matchedProcess.ProcessId] = $true; }" ^
  "  $rootProcesses = @($matchedProcesses | Where-Object { !$matchedIds.ContainsKey([int]$_.ParentProcessId) });" ^
  "  foreach ($rootProcess in $rootProcesses) {" ^
  "    & cmd.exe /d /c ('taskkill.exe /PID ' + $rootProcess.ProcessId + ' /T /F >nul 2>&1') | Out-Null;" ^
  "    if ($LASTEXITCODE -eq 0) { Write-Host ($label + ' process tree stopped. PID: ' + $rootProcess.ProcessId); }" ^
  "  }" ^
  "}" ^
  "function Start-AppProcess($name, $port, $command) {" ^
  "  $existingPid = Get-ListenerPid $port;" ^
  "  if ($existingPid) {" ^
  "    Set-Content -Path (Join-Path $pidDir ($name + '.pid')) -Value $existingPid;" ^
  "    Write-Host ($name + ' is already running on port ' + $port + '. PID: ' + $existingPid);" ^
  "    return;" ^
  "  }" ^
  "  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/s', '/c', $command) -WorkingDirectory $root -WindowStyle Hidden | Out-Null;" ^
  "  Start-Sleep -Seconds 5;" ^
  "  $pidValue = Get-ListenerPid $port;" ^
  "  if ($pidValue) {" ^
  "    Set-Content -Path (Join-Path $pidDir ($name + '.pid')) -Value $pidValue;" ^
  "    Write-Host ($name + ' started on port ' + $port + '. PID: ' + $pidValue);" ^
  "  } else {" ^
  "    Write-Host ($name + ' is starting on port ' + $port + '. PID not available yet.');" ^
  "  }" ^
  "}" ^
  "Stop-CommandTree 'prod-web' 'wrangler.*--cwd\s+\.output.*--port\s+4173';" ^
  "Stop-CommandTree 'prod-https' 'production-network-proxy\.mjs';" ^
  "foreach ($target in @(@{Name='api';Port=3001}, @{Name='web';Port=8081}, @{Name='prod-web';Port=4173}, @{Name='prod-https';Port=4174})) {" ^
  "  Stop-Port $target.Name $target.Port;" ^
  "}" ^
  "Start-Sleep -Seconds 3;" ^
  "$buildSucceeded = $false;" ^
  "for ($attempt = 1; $attempt -le 2; $attempt++) {" ^
  "  Write-Host ('Building production app... attempt ' + $attempt + '/2');" ^
  "  & npm.cmd run build;" ^
  "  if ($LASTEXITCODE -eq 0) { $buildSucceeded = $true; break }" ^
  "  if ($attempt -lt 2) { Write-Host 'Build failed; waiting for locked files to release...'; Start-Sleep -Seconds 5 }" ^
  "}" ^
  "if (!$buildSucceeded) { throw 'Production build failed.' }" ^
  "if (!(Test-Path $certPath)) { throw ('Missing HTTPS certificate: ' + $certPath + '. Run the dev server once or rebuild with Vite SSL enabled.'); }" ^
  "$apiLog = Join-Path $pidDir 'api.log';" ^
  "$prodLog = Join-Path $pidDir 'prod-web.log';" ^
  "$httpsLog = Join-Path $pidDir 'prod-https.log';" ^
  "Start-AppProcess 'api' 3001 ('npm run api > ' + [char]34 + $apiLog + [char]34 + ' 2>&1');" ^
  "Start-AppProcess 'prod-web' 4173 ('npx --yes wrangler --cwd .output dev --ip 0.0.0.0 --port 4173 > ' + [char]34 + $prodLog + [char]34 + ' 2>&1');" ^
  "Start-AppProcess 'prod-https' 4174 ('set ' + [char]34 + 'PROD_PROXY_CERT=' + $certPath + [char]34 + '&& set ' + [char]34 + 'PROD_PROXY_KEY=' + $certPath + [char]34 + '&& node server\production-network-proxy.mjs > ' + [char]34 + $httpsLog + [char]34 + ' 2>&1');" ^
  "Write-Host '';" ^
  "Write-Host 'LGU DocTrack PC HTTPS URL: https://localhost:4174';" ^
  "Write-Host ('LGU DocTrack office network URL: https://' + $lanIp + ':4174');" ^
  "Write-Host '';" ^
  "Write-Host 'Use the office network URL from other computers or phones on the same network.';" ^
  "Write-Host 'For phone PWA install, use a real trusted HTTPS domain or tunnel, not this self-signed local certificate.';" ^
  "exit 0;"

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Failed to start LGU DocTrack production. PowerShell exit code: %EXIT_CODE%
)

if /i not "%~1"=="/nopause" pause
endlocal & exit /b %EXIT_CODE%
