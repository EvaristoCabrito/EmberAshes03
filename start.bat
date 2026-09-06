@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao 20+ em https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
echo Abrindo o jogo em http://localhost:8080 ...
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8080"
call npm run dev
pause
