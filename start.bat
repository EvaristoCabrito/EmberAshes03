@echo off
REM Duplo-clique (Windows) para jogar Ember localmente.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado.
  echo Instale a versao 20 ou mais recente em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias ^(so na primeira vez, pode levar um minuto^)...
  call npm install
)

echo Abrindo o jogo em http://localhost:8080 ...
start "" http://localhost:8080

call npm run dev
