@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies for Space Adventure...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Launching Space Adventure...
call npm run dev -- --host 127.0.0.1 --open
