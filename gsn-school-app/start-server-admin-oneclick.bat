@echo off
cd /d "%~dp0"
echo Requesting elevation to create firewall rule, set HOST=0.0.0.0 and start server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0tools\\start-server-admin-oneclick.ps1\"' -Verb RunAs"
echo Helper launched. If UAC appeared approve it; the server will start elevated and listen on all interfaces.
exit /b 0
