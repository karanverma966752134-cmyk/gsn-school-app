@echo off
cd /d "c:\Users\DELL\OneDrive\Desktop\my app\gsn-school-app"
REM Default HOST to localhost for local testing; override by setting HOST env before running
set HOST=127.0.0.1
"C:\Program Files\nodejs\node.exe" server.js
pause
