@echo off
rem Double-click to set up and start Verse Scroll. Then scan the QR code with Expo Go.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Installing it now with winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo Node.js installed. Close this window and double-click start.bat again.
  pause
  exit /b
)

if not exist node_modules (
  echo Installing project packages. This takes a few minutes the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo Package install failed. Copy the messages above and send them to Claude.
    pause
    exit /b
  )
)

echo.
echo Starting Verse Scroll. Scan the QR code below with the Expo Go app.
echo If your phone can't connect, close this window and run start-tunnel.bat instead.
echo.
call npx expo start
pause
