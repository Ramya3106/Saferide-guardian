@echo off
REM ===============================================
REM SafeRide Guardian - Complete Setup & Run
REM ===============================================
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ===============================================
echo SafeRide Guardian - Setup Validation
echo ===============================================
echo.

REM Check if Node.js is installed
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js found

REM Check if npm is installed
npm -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: NPM is not installed
    pause
    exit /b 1
)
echo ✓ NPM found

REM Check if server files exist
if not exist "server\index.js" (
    echo ERROR: server\index.js not found
    pause
    exit /b 1
)
echo ✓ Backend server files found

if not exist "client\package.json" (
    echo ERROR: client\package.json not found
    pause
    exit /b 1
)
echo ✓ Client files found

echo.
echo ===============================================
echo Killing Previous Processes...
echo ===============================================
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak

echo.
echo ===============================================
echo Installing/Updating Dependencies...
echo ===============================================

REM Install server dependencies if needed
if not exist "node_modules" (
    echo Installing server dependencies...
    call npm install
)

REM Install client dependencies if needed
if not exist "client\node_modules" (
    echo Installing client dependencies...
    cd client
    call npm install
    cd ..
)

echo ✓ Dependencies ready

echo.
echo ===============================================
echo STARTING SERVERS WITH OPTIMIZED CONFIG
echo ===============================================
echo.

REM Open backend server
echo Starting Backend Server...
start "SafeRide-Backend" cmd /k "cd /d %CD% && node server/index.js"
echo ✓ Backend started

timeout /t 3 /nobreak

REM Open Metro bundler with tunnel mode
echo.
echo Starting Metro Bundler with Tunnel Mode...
echo (This bypasses firewall - works through internet)
echo.
cd client
start "SafeRide-Metro" cmd /k "npx expo start --tunnel --clear"

echo.
echo ===============================================
echo SERVERS STARTED!
echo ===============================================
echo.
echo NEXT STEPS:
echo.
echo 1. In Metro Bundler window:
echo    - Wait 15-30 seconds for tunnel to initialize
echo    - Look for: "exp://xxx.ngrok.io"
echo    - A QR code will appear
echo.
echo 2. On your Android phone:
echo    - Open Expo Go app
echo    - TAP "Scan QR code"
echo    - Point camera at the QR code
echo    - Wait for app to load (may take 30-60 seconds)
echo.
echo 3. First load will be slow - this is normal
echo    - It downloads and initializes the app
echo    - Subsequent loads will be faster
echo.
echo 4. If QR doesn't work:
echo    - Copy the tunnel URL (exp://xxx.ngrok.io)
echo    - Open Expo Go app
echo    - Tap "Enter URL manually"
echo    - Paste the URL and press Connect
echo.
echo ===============================================
echo IMPORTANT NOTES:
echo ===============================================
echo.
echo - DO NOT CLOSE THESE WINDOWS
echo - Keep both backend and metro running
echo - Internet connection needed for tunnel mode
echo - First load takes longer - be patient
echo.
echo ===============================================
pause
