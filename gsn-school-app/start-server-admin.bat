@echo off
cd /d "%~dp0"
echo Requesting elevation to create firewall rule and start server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\\start-server-admin.ps1"' -Verb RunAs"
echo Helper launched. If UAC appeared approve it; the server will start elevated.
exit /b 0
