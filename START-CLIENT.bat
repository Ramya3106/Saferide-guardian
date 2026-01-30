@echo off
cls
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                                                               ║
echo ║    SafeRide Guardian - Start Frontend (Expo Client)           ║
echo ║                                                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo ℹ️  Make sure the Backend Server is running first!
echo ℹ️  (See START-SERVER.bat)
echo.

cd /d "%~dp0client"
echo Current directory: %cd%
echo.
echo Installing dependencies (first time only)...
call npm install --legacy-peer-deps >nul 2>&1
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║ Starting Expo Metro Bundler...                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo Instructions:
echo  1. Wait for the QR code to appear below
echo  2. Open Expo Go on your Android phone
echo  3. Tap "Scan QR code"
echo  4. Point camera at the QR code
echo  5. App will download and open
echo.
npm start
