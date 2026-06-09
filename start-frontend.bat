@echo off
chcp 65001 > nul
title Mundial 2026 - Frontend
cd /d "%~dp0frontend"
echo A iniciar Frontend em http://localhost:5173 ...
npx vite
pause
