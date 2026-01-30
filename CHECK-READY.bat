@echo off
REM Check if everything is ready to run

echo.
echo ================================================
echo SafeRide Guardian - Readiness Check
echo ================================================
echo.

setlocal enabledelayedexpansion

REM Check Node.js
echo Checking Node.js...
node -v >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo [✓] Node.js !NODE_VERSION!
) else (
    echo [✗] Node.js NOT FOUND - Install from https://nodejs.org/
    exit /b 1
)

REM Check NPM
echo Checking NPM...
npm -v >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
    echo [✓] NPM !NPM_VERSION!
) else (
    echo [✗] NPM NOT FOUND
    exit /b 1
)

REM Check server files
echo Checking server files...
if exist "server\index.js" (
    echo [✓] server\index.js found
) else (
    echo [✗] server\index.js NOT FOUND
    exit /b 1
)

REM Check client files
echo Checking client files...
if exist "client\package.json" (
    echo [✓] client\package.json found
) else (
    echo [✗] client\package.json NOT FOUND
    exit /b 1
)

REM Check dependencies
echo Checking dependencies...
if exist "node_modules" (
    echo [✓] Server dependencies installed
) else (
    echo [!] Server dependencies missing - will install on first run
)

if exist "client\node_modules" (
    echo [✓] Client dependencies installed
) else (
    echo [!] Client dependencies missing - will install on first run
)

REM Check Expo
echo Checking Expo...
cd client
npx expo -v >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('npx expo -v') do set EXPO_VERSION=%%i
    echo [✓] Expo CLI !EXPO_VERSION!
) else (
    echo [!] Expo CLI not available - will install on first run
)
cd ..

REM All checks passed
echo.
echo ================================================
echo ✓ ALL CHECKS PASSED!
echo ================================================
echo.
echo You're ready to run SafeRide Guardian!
echo.
echo Next: Double-click "START-ALL.bat"
echo.
echo Then:
echo  1. Wait for QR code in Metro window (15-30s)
echo  2. Scan with Expo Go app
echo  3. Wait for app to load (30-60s first time)
echo  4. Enjoy!
echo.
echo ================================================
pause
