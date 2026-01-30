# IMMEDIATE FIX - QR Code Error

## The Problem
Your Windows Firewall is blocking port 8081, so your phone cannot connect to the Metro bundler.

## SOLUTION - Do This Now:

### Step 1: Configure Firewall (REQUIRED)

1. Press `Windows Key + I` to open Settings
2. Search for "Firewall"
3. Click "Allow an app through Windows Firewall"
4. Click "Change settings" button
5. Scroll and find **"Node.js: Server-side JavaScript"**
6. **CHECK BOTH BOXES:** ✓ Private  ✓ Public
7. Click OK

**OR Run this PowerShell command as Administrator:**
```powershell
New-NetFirewallRule -DisplayName "Node.js for Expo" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

### Step 2: Start Servers with Fixed Script

**Double-click:** `QUICK-FIX.bat`

This will:
- Configure firewall (follow prompts)
- Start backend server
- Start Metro bundler with LAN mode

### Step 3: Connect Phone

1. **Verify same WiFi:** Phone and computer on SAME network
2. Open **Expo Go** app on phone
3. **Scan QR code** from Metro Bundler window

**OR manually enter:**
- In Expo Go, tap "Enter URL manually"
- Type: `exp://10.144.132.29:8081`
- Tap Connect

---

## Alternative: Use Tunnel Mode (Bypasses Firewall)

If firewall configuration doesn't work:

```bash
cd c:\Users\divya\Documents\Saferide\Saferide-guardian\client
npx expo start --tunnel
```

Scan the new QR code. Tunnel works through internet, no local network needed.

---

## Verify Connection

**On your phone's browser**, visit:
```
http://10.144.132.29:8081
```

- **Shows Metro page?** ✓ Network works, scan QR code
- **Connection timeout?** ✗ Firewall still blocking, use tunnel mode

---

## Complete Working Setup

**Terminal 1:**
```bash
cd c:\Users\divya\Documents\Saferide\Saferide-guardian
node server/index.js
```

**Terminal 2:**
```bash
cd c:\Users\divya\Documents\Saferide\Saferide-guardian\client
npx expo start --lan
```

**On phone:** Scan QR code with Expo Go

---

## If Nothing Works: Emergency USB Method

1. Connect phone via USB cable
2. Enable USB Debugging on phone
3. Run: `cd client && npx expo start`
4. Press `a` to open on Android

---

**The firewall is blocking your connection. Fix it with QUICK-FIX.bat or use tunnel mode!**
