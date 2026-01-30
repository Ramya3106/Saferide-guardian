# 🧪 SafeRide Guardian - Testing Guide

## Quick Test Procedure

### Step 1: Install Dependencies

```bash
cd client
npm install
```

### Step 2: Start Backend Server

```bash
cd server
npm start
```

Wait for: "✓✓✓ SafeRide Guardian SERVER STARTED ✓✓✓"

### Step 3: Start Client

```bash
cd client
npm start
```

### Step 4: Scan QR Code on Android Device

1. Open Expo Go app on your Android phone
2. Tap "Scan QR code"
3. Point camera at QR code in terminal
4. **Wait for app to download** (this should now work smoothly!)

---

## 🎯 Feature Testing

### Test 1: QR Code Scanner (Happy Path)

**Steps:**

1. Login to the app
2. Navigate to any complaint that has a QR code
3. Or use Fast Navigation → "📷 Scan QR Code"
4. Grant camera permission if prompted
5. Scan a valid SafeRide QR code

**Expected Result:**

- ✅ Camera opens successfully
- ✅ QR code detected automatically
- ✅ Loading indicator appears
- ✅ Navigates to complaint detail screen
- ✅ Shows "Success" message

### Test 2: QR Code Scanner (Network Failure)

**Steps:**

1. Enable Airplane mode on your phone
2. Open QR Scanner
3. Try to scan a QR code

**Expected Result:**

- ✅ "❌ No Internet Connection" banner appears
- ✅ Alert shows network error message
- ✅ "Try Again" and "Cancel" options available
- ✅ When network restored, can retry successfully

### Test 3: QR Code Scanner (Invalid QR Code)

**Steps:**

1. Scan a random/non-SafeRide QR code

**Expected Result:**

- ✅ Shows error: "Invalid QR code format"
- ✅ Can try again
- ✅ Manual entry option available

### Test 4: Fast Navigation Panel

**Steps:**

1. Login to app
2. Check top of Home screen

**Expected Result:**

- ✅ Horizontal scrollable panel visible
- ✅ Shows: Home, Report, My Complaints, Scan QR, Profile
- ✅ Each item navigates correctly
- ✅ Icons and descriptions are clear

### Test 5: Network Connectivity Monitoring

**Steps:**

1. Open any complaint detail
2. Turn on Airplane mode
3. Turn off Airplane mode

**Expected Result:**

- ✅ Red banner appears when offline
- ✅ Banner disappears when online
- ✅ Data auto-reloads when connection restored

### Test 6: Pull-to-Refresh

**Steps:**

1. Go to "My Complaints" screen
2. Pull down from top
3. Release

**Expected Result:**

- ✅ Refresh spinner appears
- ✅ Data reloads
- ✅ Spinner disappears when complete

### Test 7: Socket.io Real-time Updates

**Steps:**

1. Open a complaint detail screen
2. From another device/browser, update the complaint status
3. Watch the first device

**Expected Result:**

- ✅ Status updates automatically without refresh
- ✅ No errors in console
- ✅ Timeline updates visually

### Test 8: Automatic Retry Mechanism

**Steps:**

1. Stop the backend server
2. Try to load complaint details
3. Restart the server within 10 seconds

**Expected Result:**

- ✅ Initial request fails
- ✅ Console shows retry attempts (1/3, 2/3, 3/3)
- ✅ Eventually succeeds when server is back
- ✅ Data loads correctly

---

## 🔍 Error Scenarios to Test

### Scenario A: Server Completely Down

**Test:**

1. Stop backend server
2. Try to scan QR code

**Expected:**

- Clear error message
- Retry button
- No app crash

### Scenario B: Slow Network

**Test:**

1. Enable network throttling (if possible)
2. Scan QR code

**Expected:**

- Extended timeout (30s)
- Loading indicator stays visible
- Eventually succeeds or shows timeout error

### Scenario C: Invalid Complaint ID

**Test:**

1. Use manual entry with invalid ID

**Expected:**

- "Resource not found" error
- Option to go back
- No crash

### Scenario D: Multiple Rapid QR Scans

**Test:**

1. Scan QR code
2. Immediately scan another

**Expected:**

- First scan completes or cancels
- Second scan starts cleanly
- No duplicate processing

---

## 📊 Console Log Checks

### Successful QR Scan Should Show:

```
[QR Scanner] Processing QR code: saferide://complaint/...
[Network] Initial state: { isConnected: true, ... }
[API] GET .../api/complaints/...
[QR Scanner] Fetching complaint ... (Attempt 1/3)
[QR Scanner] Complaint fetched successfully
[Socket] Connecting to: http://...
[Socket] Connected: ...
```

### Failed Network Should Show:

```
[API Response Error] { code: 'ECONNREFUSED', ... }
[API Retry] Attempt 1/3 for /complaints/...
[API Retry] Attempt 2/3 for /complaints/...
[API Retry] Attempt 3/3 for /complaints/...
```

---

## ✅ Success Criteria

All tests pass when:

- ✅ No app crashes
- ✅ Clear error messages for all failure cases
- ✅ Automatic retry works correctly
- ✅ Network status is always visible
- ✅ QR scanner handles all edge cases
- ✅ Fast Navigation works from all screens
- ✅ Pull-to-refresh works on all data screens
- ✅ Socket.io reconnects automatically
- ✅ Manual entry fallback is available
- ✅ Loading states are clear and accurate

---

## 🐛 Known Issues (If Any)

### Issue: Camera permission on first launch

**Workaround:** User must grant permission in Settings if denied

### Issue: QR codes with damaged/unclear images

**Workaround:** Use manual entry option

---

## 📱 Test Devices

Recommended testing on:

- [ ] Android phone (primary target)
- [ ] Android emulator (10.0.2.2 network)
- [ ] iOS simulator (if available)
- [ ] Different network speeds (WiFi, 4G, 3G)

---

## 🎉 Deployment Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] No console errors
- [ ] Network retry works
- [ ] QR scanner is smooth
- [ ] Error messages are user-friendly
- [ ] Performance is acceptable
- [ ] Documentation is up to date
- [ ] Backend API is accessible
- [ ] Socket.io server is running
- [ ] MongoDB is connected

---

**Happy Testing! 🚀**
