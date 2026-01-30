@echo off
echo ========================================
echo FIXING QR CODE ERROR - Step by Step
echo ========================================
echo.

echo Step 1: Opening Windows Firewall...
echo.
start "" "ms-settings:network-firewall"
echo.
echo IMPORTANT: In the window that opened:
echo 1. Click "Allow an app through firewall"
echo 2. Click "Change settings" button at top
echo 3. Find "Node.js: Server-side JavaScript"
echo 4. CHECK BOTH boxes: Private AND Public
echo 5. Click OK
echo.
echo Press any key AFTER you've done the above...
pause

echo.
echo Step 2: Killing any existing Metro processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak

echo.
echo Step 3: Starting Backend Server...
cd /d "%~dp0"
start "Backend Server" cmd /k "node server/index.js"
timeout /t 3 /nobreak

echo.
echo Step 4: Starting Metro with LAN connection...
cd client
start "Metro Bundler" cmd /k "npx expo start --lan"

echo.
echo ========================================
echo SETUP COMPLETE!
echo ========================================
echo.
echo Now on your phone:
echo 1. Make sure you're on the SAME WiFi as your computer
echo 2. Open Expo Go app
echo 3. Scan the QR code from the Metro window
echo.
echo If QR still doesn't work:
echo - In Metro window, note the URL (exp://10.144.132.29:8081)
echo - Open Expo Go app
echo - Tap "Enter URL manually" 
echo - Type the URL and press Connect
echo.
echo ========================================
pause
