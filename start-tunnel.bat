@echo off
rem Use this if your phone can't reach your computer over Wi-Fi. Run start.bat once first.
cd /d "%~dp0"
call npx expo start --tunnel
pause
