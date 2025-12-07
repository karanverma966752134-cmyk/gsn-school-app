@echo off
cd /d "%~dp0"

REM Start watcher on alternate port to avoid conflicts
set PORT=3001
REM Default HOST to localhost for local testing; override by setting HOST env before running
set HOST=127.0.0.1

REM Start the watcher which will run node and restart on exit.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\watch-server.ps1"

exit /b 0
