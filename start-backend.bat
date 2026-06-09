@echo off
chcp 65001 > nul
title Mundial 2026 - Backend
cd /d "%~dp0backend"
echo A iniciar Backend em http://localhost:3002 ...
npx tsx src/index.ts
pause
