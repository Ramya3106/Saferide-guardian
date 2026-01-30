@echo off
echo ========================================
echo SafeRide Guardian - Start Development
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "server\index.js" (
    echo ERROR: Please run this from the project root directory
    pause
    exit /b 1
)

echo Starting backend server in new window...
start "SafeRide Backend" cmd /k "cd /d %CD% && node server/index.js"

echo Waiting for backend to initialize...
timeout /t 5 /nobreak

echo.
echo Starting Metro bundler with tunnel mode...
echo (Tunnel mode works through any network/firewall)
echo.
cd client
start "Metro Bundler" cmd /k "npx expo start --tunnel"

echo.
echo ========================================
echo BOTH SERVERS STARTED!
echo ========================================
echo.
echo Backend: Check "SafeRide Backend" window
echo Metro: Check "Metro Bundler" window
echo.
echo When you see the QR code in Metro window:
echo 1. Scan with Expo Go app on your phone
echo 2. Or press 'a' to open on Android emulator
echo.
echo ========================================
pause
