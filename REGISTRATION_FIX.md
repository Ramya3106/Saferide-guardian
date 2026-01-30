# Registration Error Fix - Summary

## Problem

Registration failed with error: "Cannot connect to server, please check your connection"

## Root Causes Identified

### 1. Incorrect IP Address Configuration

The fallback IP in `client/src/services/api.js` was set to `192.168.1.100`, but your actual machine IP is `10.144.132.29`.

### 2. Backend Server Not Running

The server needs to be running on port 5000 for the client to connect.

## Fixes Applied

### 1. Updated API Configuration

**File:** `client/src/services/api.js`

- Changed fallback IP from `192.168.1.100` to `10.144.132.29`
- Enhanced error logging to show full URL being called
- Added better timeout and connection error handling

### 2. Updated Server IP Display

**File:** `server/index.js`

- Updated physical device IP display to `10.144.132.29`

### 3. Enhanced Error Handling

Improved API interceptor to catch more connection error types:

- ECONNREFUSED
- ECONNABORTED
- Network errors
- Timeout errors

## How to Use

### Step 1: Start the Backend Server

```bash
cd c:\Users\divya\Documents\Saferide\Saferide-guardian
npm start
```

You should see:

```
MongoDB connected
SafeRide Guardian server running on port 5000
Server accessible at http://localhost:5000
For Android emulator: http://10.0.2.2:5000
For physical devices: http://10.144.132.29:5000
```

**IMPORTANT:** Keep this terminal window open. The server must remain running.

### Step 2: Start the Client (in a NEW terminal)

```bash
cd c:\Users\divya\Documents\Saferide\Saferide-guardian\client
npm start
```

### Step 3: Run on Device/Emulator

- Press `a` for Android emulator (uses 10.0.2.2:5000)
- Press `i` for iOS simulator (uses localhost:5000)
- Scan QR code for physical device (uses 10.144.132.29:5000)

## Testing the Fix

### Test 1: Server Health Check

Open browser and visit: http://localhost:5000/api/health

You should see:

```json
{ "status": "SafeRide Guardian API Running", "timestamp": "2026-..." }
```

### Test 2: Physical Device Connection

On your phone's browser (must be on same WiFi), visit:
http://10.144.132.29:5000/api/health

### Test 3: Registration

1. Open the app
2. Click "Register" or "Create Account"
3. Fill in:
   - Name: Test User
   - Phone: 1234567890
   - Password: test123
   - Role: Passenger
4. Click "Register"

Expected result: "Registration successful!" message

## Troubleshooting

### If server won't start:

```bash
# Check if port 5000 is already in use
netstat -ano | findstr :5000

# If something is using it, kill the process:
taskkill /PID <process_id> /F
```

### If physical device can't connect:

1. **Check same WiFi**: Phone and computer must be on the same network
2. **Check IP**: Run `ipconfig` and verify your IPv4 address
3. **Windows Firewall**:
   - Open Windows Defender Firewall
   - Click "Allow an app through firewall"
   - Find Node.js and allow it
4. **Update IP if changed**: If your IP changed, update line ~38 in `client/src/services/api.js`

### If MongoDB errors occur:

The server will still start but database operations will fail. Install MongoDB:

- Download from: https://www.mongodb.com/try/download/community
- OR use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

## Network Configuration Details

The app uses different URLs depending on where it's running:

| Platform         | URL Used                      | Configured In     |
| ---------------- | ----------------------------- | ----------------- |
| Android Emulator | http://10.0.2.2:5000/api      | api.js Line 28    |
| iOS Simulator    | http://localhost:5000/api     | api.js Line 32    |
| Physical Device  | http://10.144.132.29:5000/api | api.js Line 38    |
| Expo Dev (auto)  | http://<LAN_IP>:5000/api      | api.js Line 17-23 |

## Debugging Tips

### Check what URL the app is using:

Open React Native DevTools console and look for:

```
API Request: POST http://10.144.132.29:5000/api/auth/register
```

### Common error messages and meanings:

| Error                      | Meaning                           | Solution                                   |
| -------------------------- | --------------------------------- | ------------------------------------------ |
| "Cannot connect to server" | Backend not running or wrong IP   | Start server, verify IP                    |
| "Network Error"            | Firewall or network issue         | Check firewall, WiFi                       |
| "timeout"                  | Server too slow or not responding | Check server logs                          |
| "Phone already registered" | User exists                       | This is normal, use different phone number |

## Files Modified

1. `client/src/services/api.js` - Updated IP and error handling
2. `server/index.js` - Updated IP display
3. `SETUP.md` - New setup guide (this file)
4. `test-server.js` - New test script

## Next Steps

After completing the steps above, try registering again. The error should be fixed!

If you still face issues:

1. Check both terminal windows (server and client) for error messages
2. Look at the React Native DevTools console
3. Verify the URL being called matches your setup
4. Ensure server shows "MongoDB connected" message

Need more help? Check `SETUP.md` for detailed troubleshooting.
