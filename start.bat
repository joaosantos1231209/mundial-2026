@echo off
chcp 65001 > nul
echo ============================================
echo  MUNDIAL FIFA 2026 - A iniciar...
echo ============================================
echo.

echo [1/2] Backend (porta 3002)...
start "Mundial - Backend" "%~dp0start-backend.bat"

timeout /t 5 /nobreak > nul

echo [2/2] Frontend (porta 5173)...
start "Mundial - Frontend" "%~dp0start-frontend.bat"

timeout /t 6 /nobreak > nul

echo.

:: Obter IP da rede local (Wi-Fi / Ethernet)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
  set LOCAL_IP=%%a
  goto :found
)
:found
set LOCAL_IP=%LOCAL_IP: =%

echo ============================================
echo  Acesso no PC:        http://localhost:5173
echo  Acesso no telemovel: http://%LOCAL_IP%:5173
echo ============================================
echo.
echo  Assegura-te que o telemovel esta na mesma rede Wi-Fi!
echo ============================================
echo.
start "" "http://localhost:5173"
