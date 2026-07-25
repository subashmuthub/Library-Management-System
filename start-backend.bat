@echo off
echo Starting Smart Library Backend...
cd /d "d:\!Library_management_system\zbackend"
node database/ensure-ready.js
node src/app.js
pause
