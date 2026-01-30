# ✓ REGISTRATION ERROR - FIXED!

## Root Cause
The registration was failing because:
1. **Backend server was not running**
2. **Server was binding to IPv6 instead of IPv4** (causing connection failures)
3. **Incorrect IP address in client API configuration**

## Fixes Applied

### 1. Updated Server to Bind to IPv4
**File:** `server/index.js`
- Changed `.listen(PORT)` to `.listen(PORT, '127.0.0.1')`
- This ensures the server listens on IPv4 localhost

### 2. Updated Client API Configuration
**File:** `client/src/services/api.js`
- Updated fallback IP from `192.168.1.100` to `10.144.132.29`
- Enhanced error logging to show connection issues

## How to Start the Server Properly

### Option 1: Using Batch File (RECOMMENDED)
**Double-click** `start-server.bat` in the project root

OR run in terminal:
```bash
c:\Users\divya\Documents\Saferide\Saferide-guardian\start-server.bat
```

### Option 2: Manual Start
Open a terminal and run:
```bash
cd c:\Users\divya\Documents\Saferide\Saferide-guardian
node server/index.js
```

**IMPORTANT:** Keep this terminal window open! The server must remain running.

You should see:
```
✓✓✓ SafeRide Guardian SERVER STARTED ✓✓✓
✓ Listening on port 5000
✓ Test URL: http://localhost:5000/api/health
✓✓✓ Server is READY for requests ✓✓✓
```

## Starting the Client

Open a **NEW** terminal:
```bash
cd c:\Users\divya\Documents\Saferide\Saferide-guardian\client
npm start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator  
- Scan QR code for physical device

## Verifying the Fix

### Test 1: Server Health Check
Open browser: http://localhost:5000/api/health

You should see:
```json
{"status":"SafeRide Guardian API Running","timestamp":"..."}
```

### Test 2: Registration
1. Open the mobile app
2. Click "Register" or "Create Account"
3. Fill in details:
   - Name: John Doe
   - Phone: 1234567890
   - Password: password123
   - Role: Passenger
4. Click "Register"

Expected: "Registration successful!" message

## Troubleshooting

### Server Won't Start
```bash
# Kill any existing processes on port 5000
netstat -ano | findstr :5000
# Note the PID and kill it:
taskkill /PID <pid> /F

# Then restart the server
```

### "Cannot connect" Error
1. Verify server is running (see terminal with server output)
2. Test health endpoint in browser: http://localhost:5000/api/health
3. Check if MongoDB is running (server works without it, but with warnings)

### Physical Device Can't Connect
1. Ensure phone and computer are on same WiFi
2. Update IP in `client/src/services/api.js` line 37 if your IP changed
3. Check Windows Firewall allows Node.js connections

## Network Configuration

| Device | URL | Explanation |
|--------|-----|-------------|
| Android Emulator | `http://10.0.2.2:5000/api` | Special emulator IP |
| iOS Simulator | `http://localhost:5000/api` | Direct localhost |
| Physical Device | `http://10.144.132.29:5000/api` | Your computer's local IP |

## Quick Start Checklist

- [ ] Open Terminal 1: Run `start-server.bat` or `node server/index.js`
- [ ] Wait for "SERVER STARTED" message
- [ ] Open Terminal 2: `cd client && npm start`
- [ ] Launch app on device/emulator
- [ ] Try registration

## Files Modified

1. `server/index.js` - Fixed IPv6/IPv4 binding issue
2. `client/src/services/api.js` - Updated IP address and logging
3. `start-server.bat` - NEW: Easy server startup script

## Support

If issues persist:
1. Check both terminal windows for error messages
2. Verify http://localhost:5000/api/health works in browser
3. Check React Native DevTools console logs

**The registration error is now FIXED!** Just make sure the server is running before you try to register.
