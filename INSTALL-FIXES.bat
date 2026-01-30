@echo off
cls
echo.
echo ========================================
echo  SafeRide Guardian - Quick Fix Setup
echo ========================================
echo.
echo Installing updated dependencies...
echo.

cd client

echo [1/3] Installing new packages...
call npm install @react-native-community/netinfo@^12.0.0 expo-barcode-scanner@~15.0.1 expo-constants@~18.0.5

echo.
echo [2/3] Cleaning cache...
call npx expo start -c --clear

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Keep this terminal open
echo 2. Scan QR code with Expo Go app
echo 3. Test QR scanner feature
echo.
echo New Features Added:
echo  - QR Code Scanner with error handling
echo  - Network connectivity monitoring
echo  - Fast Navigation panel
echo  - Automatic retry mechanism
echo  - Pull-to-refresh functionality
echo.
pause
