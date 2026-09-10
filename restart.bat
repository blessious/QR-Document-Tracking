@echo off
setlocal

call "%~dp0stop.bat" /nopause
powershell -NoProfile -Command "Start-Sleep -Seconds 2"
call "%~dp0run.bat" /nopause

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Failed to restart LGU DocTrack. Exit code: %EXIT_CODE%
)

pause
endlocal & exit /b %EXIT_CODE%
