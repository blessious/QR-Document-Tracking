@echo off
setlocal

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo Requesting Administrator permission to allow LGU DocTrack through Windows Firewall...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

netsh advfirewall firewall add rule name="LGU DocTrack API 3001" dir=in action=allow protocol=TCP localport=3001 >nul
netsh advfirewall firewall add rule name="LGU DocTrack Production 4173" dir=in action=allow protocol=TCP localport=4173 >nul
netsh advfirewall firewall add rule name="LGU DocTrack HTTPS 4174" dir=in action=allow protocol=TCP localport=4174 >nul

echo LGU DocTrack network firewall rules are ready.
pause
endlocal
