@echo off
title Rugs Claude
rem Opens Claude in the Rugs Workspace folder. Works on any laptop.

set "WS="
if exist "%~dp0index.html" set "WS=%~dp0"
if not defined WS if exist "%USERPROFILE%\Desktop\Workspace\index.html" set "WS=%USERPROFILE%\Desktop\Workspace"
if not defined WS if exist "%USERPROFILE%\OneDrive\Desktop\Workspace\index.html" set "WS=%USERPROFILE%\OneDrive\Desktop\Workspace"
if not defined WS if exist "C:\Users\Administrator\Desktop\Workspace\index.html" set "WS=C:\Users\Administrator\Desktop\Workspace"

if not defined WS (
  echo.
  echo  Could not find the Workspace folder on this laptop.
  echo  Put this file inside the Workspace folder, or put the Workspace
  echo  folder on the Desktop, then try again.
  echo.
  pause
  exit /b 1
)

cd /d "%WS%"

where claude >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Claude is not installed on this laptop, or not set up yet.
  echo  Open PowerShell and run:   irm https://claude.ai/install.ps1 ^| iex
  echo  Then close this window and open Rugs Claude again.
  echo.
  pause
  exit /b 1
)

claude
if errorlevel 1 (
  echo.
  echo  Claude closed with an error. Read the message above.
  echo.
  pause
)
