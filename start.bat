@echo off
setlocal
cd /d "%~dp0"
set "LOG=%~dp0log.txt"

echo ============================================ > "%LOG%"
echo  Ember - registro de inicializacao          >> "%LOG%"
echo  %date% %time%                              >> "%LOG%"
echo  pasta: %~dp0                               >> "%LOG%"
echo ============================================ >> "%LOG%"
echo. >> "%LOG%"

echo.
echo   Tudo o que acontecer aqui esta sendo gravado em:
echo   %LOG%
echo   Se der errado, esse arquivo abre sozinho no Bloco de Notas.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. >> "%LOG%"
  echo Instale a versao LTS em https://nodejs.org e reinicie o computador. >> "%LOG%"
  echo.
  echo   ERRO: Node.js nao esta instalado.
  echo   Baixe a versao LTS em https://nodejs.org, instale e REINICIE o PC.
  echo.
  start "" notepad "%LOG%"
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do echo Node: %%v >> "%LOG%"

if not exist node_modules (
  echo.
  echo   ============================================
  echo    PRIMEIRA VEZ - PRECISA DE INTERNET
  echo   ============================================
  echo.
  echo   Baixando o que o jogo precisa. De 3 a 5 minutos.
  echo   NAO FECHE esta janela.
  echo.
  echo   Depois desta vez o jogo roda SEM INTERNET,
  echo   e esta parte nunca mais acontece.
  echo.
  echo --- npm install --- >> "%LOG%"
  powershell -NoProfile -Command "& { npm install 2>&1 | Tee-Object -FilePath '%LOG%' -Append }"
  if errorlevel 1 goto falhou
) else (
  echo   Ja instalado - rodando OFFLINE, sem internet. >> "%LOG%"
  echo   Ja instalado. Nao precisa de internet.
)

echo --- npm run dev --- >> "%LOG%"
echo.
echo   Abrindo o jogo em http://localhost:8080
echo   Deixe esta janela aberta enquanto joga.
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:8080"
powershell -NoProfile -Command "& { npm run dev 2>&1 | Tee-Object -FilePath '%LOG%' -Append }"
if errorlevel 1 goto falhou

echo.
echo   O jogo foi encerrado.
pause
exit /b 0

:falhou
echo.
echo   ============================================
echo    DEU ERRO
echo   ============================================
echo.
echo   Abrindo o registro no Bloco de Notas.
echo   Copie o texto todo e mande para o Claude.
echo.
start "" notepad "%LOG%"
pause
exit /b 1
