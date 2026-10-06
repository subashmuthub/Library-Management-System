@echo off
echo ===================================================
echo Starting Smart Library Automation System...
echo ===================================================

echo Starting Backend on http://localhost:3001 ...
start "Smart Library Backend" cmd /k "cd /d "%~dp0zbackend" && node database/ensure-ready.js && node src/app.js"

ping 127.0.0.1 -n 4 >nul

echo Starting Frontend on http://localhost:5176 ...
start "Smart Library Frontend" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

echo.
echo Both services have been launched in separate windows!
echo Access the application at: http://localhost:5176
echo.
