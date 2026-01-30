#!/bin/bash
# Emergency fix script for macOS/Linux users
# For Windows users, use START-ALL.bat

cd "$(dirname "$0")"

echo "=========================================="
echo "SafeRide Guardian - Full Reset & Start"
echo "=========================================="
echo ""

# Kill existing processes
echo "Cleaning up old processes..."
pkill -f "node server/index.js" 2>/dev/null
pkill -f "expo start" 2>/dev/null
sleep 2

echo ""
echo "Starting backend server..."
node server/index.js &
BACKEND_PID=$!
sleep 3

echo ""
echo "Starting Metro bundler with tunnel..."
cd client
npx expo start --tunnel --clear &
METRO_PID=$!

echo ""
echo "=========================================="
echo "Servers running!"
echo "=========================================="
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Metro PID: $METRO_PID"
echo ""
echo "Scan the QR code with Expo Go app"
echo ""

wait
