@echo off
:: Lanzar Expo con Node 20 LTS (requerido por Expo 52)
set "NODE20=C:\Users\josep\node20"
set "PATH=%NODE20%;%PATH%"
echo Node version:
"%NODE20%\node.exe" --version
echo.
echo Iniciando Expo...
"%NODE20%\npx.cmd" expo start %*
