@echo off
REM Inicia el agente de impresion de La Pampa (HU16). Pon un acceso directo a este
REM archivo en shell:startup para que arranque con el PC de la caja.
cd /d "%~dp0"
title Agente de impresion - La Pampa
:inicio
node src\index.js
echo El agente se detuvo. Se reinicia en 10 segundos...
timeout /t 10 /nobreak >nul
goto inicio
