@echo off
echo Starting Smart Library Backend...
cd /d "%~dp0zbackend"
node database/ensure-ready.js
node src/app.js
pause
