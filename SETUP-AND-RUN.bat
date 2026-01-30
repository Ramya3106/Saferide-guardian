@echo off
cls
echo.
echo ========================================
echo  SafeRide Guardian - Complete QR Fix
echo ========================================
echo.

REM Kill any existing node processes
taskkill /F /IM node.exe /T 2>nul

echo [1/5] Waiting for cleanup...
timeout /t 2 /nobreak

echo [2/5] Navigating to Saferide-guardian folder...
cd /d "C:\Users\divya\Documents\Saferide\Saferide-guardian"

echo [3/5] Installing server dependencies...
cd server
call npm install --legacy-peer-deps
timeout /t 3 /nobreak

echo [4/5] Installing client dependencies...
cd ..\client
call npm install --legacy-peer-deps
timeout /t 3 /nobreak

echo.
echo ========================================
echo [5/5] SETUP COMPLETE!
echo ========================================
echo.
echo Next steps:
echo 1. Open TWO terminals:
echo.
echo Terminal 1: cd "C:\Users\divya\Documents\Saferide\Saferide-guardian\server"
echo             npm start
echo.
echo Terminal 2: cd "C:\Users\divya\Documents\Saferide\Saferide-guardian\client"
echo             npm start
echo.
echo 3. Scan the QR code shown in Terminal 2 using Expo Go on your Android phone
echo.
echo ========================================
echo.
pause
