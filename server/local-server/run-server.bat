@echo off
cd /d "%~dp0"
echo Checking packages...
call npm install --omit=dev
if not exist .env (echo Create .env first: copy .env.example to .env, then fill it in. & pause & exit /b 1)
echo.
echo Rugs Email server. It updates itself from GitHub and restarts on its own.
echo Close this window to stop it.
echo.
:loop
node server.mjs
echo.
echo Server stopped or updated - starting again in 3 seconds. Press Ctrl+C twice to stop for good.
timeout /t 3 /nobreak >nul
goto loop
