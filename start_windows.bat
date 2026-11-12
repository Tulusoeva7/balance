@echo off
setlocal
cd /d %~dp0
where node >nul 2>nul || (echo [ERROR] Install Node.js 18 or newer first. & pause & exit /b 1)
where python >nul 2>nul || (echo [ERROR] Install Python 3.10 or newer first. & pause & exit /b 1)
if not exist node_modules\vite\bin\vite.js (
  echo Installing frontend dependencies...
  call npm install || (pause & exit /b 1)
)
if not exist backend\.venv\Scripts\python.exe (
  echo Creating Python environment...
  python -m venv backend\.venv || (pause & exit /b 1)
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt || (pause & exit /b 1)
)
set BALANCE_PYTHON=backend\.venv\Scripts\python.exe
call npm run dev
pause
