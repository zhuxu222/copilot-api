@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo  Copilot API Proxy - One-Click Setup ^& Start
echo ============================================================
echo.

:: ── Config ──────────────────────────────────────────────────
:: Admin 面板密码 (修改为你自己的密码)
set LOCAL_ACCESS_PASSWORD=copilot123

:: 监听配置
set HOST=::
set PORT=4141

:: 企业代理 (vm-in VPN 才能访问的外网)
set PROXY_ENV=true
set http_proxy=https://copilot-proxy.lenovo.com:8000
set https_proxy=https://copilot-proxy.lenovo.com:8000

:: 允许局域网访问 Admin 面板
set LOCAL_ACCESS_MODE=container-bridge
:: ─────────────────────────────────────────────────────────────

:: Step 1: Check / Install Bun
echo [Step 1] Checking Bun runtime...

set BUN_PATH=%USERPROFILE%\.bun\bin\bun.exe

if exist "%BUN_PATH%" (
    echo [*] Bun found: %BUN_PATH%
    goto :deps
)

echo [!] Bun not found. Installing...
echo.
powershell -Command "irm bun.sh/install.ps1 | iex"
if %ERRORLEVEL% neq 0 (
    echo [X] Failed to install Bun. Please install manually: https://bun.sh
    pause
    exit /b 1
)

:: Refresh PATH to include bun
set PATH=%USERPROFILE%\.bun\bin;%PATH%
echo [*] Bun installed successfully.
echo.

:: Step 2: Install dependencies
:deps
echo [Step 2] Installing dependencies...
cd /d "%~dp0"
call "%BUN_PATH%" install
if %ERRORLEVEL% neq 0 (
    echo [X] Failed to install dependencies.
    pause
    exit /b 1
)
echo.

:: Step 3: Start server
echo [Step 3] Starting Copilot API Proxy...
echo.
echo   ┌─────────────────────────────────────────┐
echo   │  API:     http://[fd3e:7070:d4dc::364]:%PORT%/v1/messages
echo   │  Admin:   http://[fd3e:7070:d4dc::364]:%PORT%/admin
echo   │  User:    copilot
echo   │  Password: %LOCAL_ACCESS_PASSWORD%
echo   └─────────────────────────────────────────┘
echo.
echo [*] Press Ctrl+C to stop.
echo.

"%BUN_PATH%" run start

pause
