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

:: 允许局域网访问 Admin 面板
set LOCAL_ACCESS_MODE=container-bridge

:: 企业代理 (仅 Phase 3 启动服务时使用，安装依赖时不设)
set UPSTREAM_PROXY=https://copilot-proxy.lenovo.com:8000

:: Bun CA 证书 (信任企业代理的自签名 TLS 证书)
set CA_CERT_FILE=%~dp0copilotproxy-ca.pem
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

set PATH=%USERPROFILE%\.bun\bin;%PATH%
echo [*] Bun installed successfully.
echo.

:: Step 2: Install dependencies (VPN off, direct internet)
:deps
echo [Step 2] Installing dependencies (direct internet, no proxy)...
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
echo   +-- Network Check -----------------------------------+
echo   ^|  Corporate proxy: %UPSTREAM_PROXY%
echo   ^|  CA cert:          %CA_CERT_FILE%

if exist "%CA_CERT_FILE%" (
    echo   ^|  CA cert found:    YES
) else (
    echo   ^|  CA cert found:    NO  ^(TLS to proxy may fail^)
)
echo   +---------------------------------------------------+
echo.
echo   +-- Access -----------------------------------------+
echo   ^|  API:     http://[fd3e:7070:d4dc::364]:%PORT%/v1/messages
echo   ^|  Admin:   http://[fd3e:7070:d4dc::364]:%PORT%/admin
echo   ^|  User:    copilot
echo   ^|  Password: %LOCAL_ACCESS_PASSWORD%
echo   +---------------------------------------------------+
echo.
echo [*] Press Ctrl+C to stop.
echo.

:: 设置企业代理 (copilot-api 通过此代理访问 GitHub Copilot)
set PROXY_ENV=true
set http_proxy=%UPSTREAM_PROXY%
set https_proxy=%UPSTREAM_PROXY%

:: 让 Bun/Node.js 信任企业代理的自签名 TLS 证书
if exist "%CA_CERT_FILE%" (
    set NODE_EXTRA_CA_CERTS=%CA_CERT_FILE%
)

"%BUN_PATH%" run start

pause
