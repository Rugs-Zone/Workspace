@echo off
rem Rugs Mail server runner: starts the mail server and restarts it if it ever stops.
cd /d "%~dp0"
:loop
echo %date% %time% starting >> server-log.txt
node server.mjs >> server-log.txt 2>&1
echo %date% %time% stopped, restarting in 10 s >> server-log.txt
ping -n 11 127.0.0.1 >nul
goto loop
