# Passenger Dashboard - Implementation Quick Reference

## 📁 File Structure

```
SafeRide-guardian/
├── client/
│   ├── App.js                          ← Updated with PassengerDashboard routing
│   ├── PassengerDashboard.js           ← 🆕 New main dashboard component (all 10 sections)
│   ├── package.json
│   ├── metro.config.js
│   ├── index.js
│   ├── app.json
│   └── babel.config.js
│
├── server/
│   ├── src/
│   │   ├── app.js                      ← Updated to include passenger routes
│   │   ├── index.js
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   │   ├── User.js                 ← 🆕 User model
│   │   │   ├── Complaint.js            ← 🆕 Complaint model
│   │   │   └── Journey.js              ← 🆕 Journey model
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── health.js
│   │       └── passenger.js            ← 🆕 Passenger endpoints
│   └── package.json
│
├── SETUP_GUIDE.md                      ← 🆕 Setup and testing guide
└── API_DOCUMENTATION.md                ← 🆕 Detailed API reference
```

---

## 🎯 Component Architecture

### PassengerDashboard.js
The main dashboard component with 10 sections:

```
PassengerDashboard
├── Section 1: Header (name, phone, GPS, notifications)
├── Section 2: Active Journey Card
├── Section 3: Primary Action Button ("I LEFT SOMETHING")
├── Section 4: Complaint Creation Modal
├── Section 5: Complaint Status Tracker
├── Section 6: Live Tracking Map
├── Section 7: Staff Messages Panel
├── Section 8: QR Code Pickup
├── Section 9: Complaint History Modal
├── Section 10: Emergency & Help Buttons
└── Logout Button
```

### Database Models

**User Model** (`server/src/models/User.js`)
- Stores user account information
- Role-based (Passenger, Driver, Conductor, TTR/RPF, Police)
- Passenger-specific fields (travel details)
- Staff-specific fields (duty roster)

**Journey Model** (`server/src/models/Journey.js`)
- Tracks active/completed journeys
- Stores vehicle, route, stops, timing
- Current stop updates
- GPS location tracking

**Complaint Model** (`server/src/models/Complaint.js`)
- Lost item complaints
- Links to journey and staff
- Status tracking (5 states)
- Messages and QR code
- GPS location capture

---

## 🔌 API Integration Points

### Frontend → Backend Communication

1. **Fetch Active Journey**
   ```
   GET /api/passenger/dashboard
   Headers: X-User-Email
   ```

2. **Create Complaint**
   ```
   POST /api/passenger/complaints
   Body: itemType, description, lastSeenLocation, vehicleNumber, route
   ```

3. **Get Complaint History**
   ```
   GET /api/passenger/complaints
   Footer info: auto-populated from journey
   ```

4. **Monitor Status**
   ```
   GET /api/passenger/complaints/:id
   Status tracker reads: staffNotified, itemFound, meetingScheduled, itemCollected
   ```

5. **Live Tracking**
   ```
   GET /api/passenger/tracking/:complaintId
   Map component: staffLocation, meetingPoint, ETA
   ```

6. **Messages**
   ```
   GET /api/passenger/messages/:complaintId
   Display staff messages in chat panel
   ```

---

## 🚀 Workflow Flow

```
User Registration & Login
        ↓
  [Auth Email Verification]
        ↓
  [PassengerDashboard Loads]
        ↓
  [Display Active Journey] ← GET /dashboard
        ↓
User clicks "I LEFT SOMETHING"
        ↓
  [Complaint Modal Opens]
        ↓
User fills form + submits
        ↓
  [Create Complaint] → POST /complaints
        ↓
Return complaint with auto-filled journey data
        ↓
  [Status Tracker Updates]
        ↓
  [Live Tracking Activates] → GET /tracking/:id
        ↓
User receives staff messages → GET /messages/:id
        ↓
Staff provides meeting point & time
        ↓
User scans QR code to confirm pickup
        ↓
  [Item Marked as Collected] → POST /qr-code/:id
        ↓
Complaint Status: RECOVERED
        ↓
Saved to history for future reference
```

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│   CLIENT    │
│ PassengerDB │
└──────┬──────┘
       │
       │ API Requests (Headers: X-User-Email)
       ↓
┌──────────────────────┐
│   SERVER/ROUTES      │
│  passenger.js        │
├──────────────────────┤
│ • /dashboard         │
│ • /complaints        │
│ • /tracking          │
│ • /messages          │
│ • /qr-code           │
│ • /gps               │
│ • /journey           │
└──────┬───────────────┘
       │
       │ CRUD Operations
       ↓
┌──────────────────────┐
│   Database Models    │
├──────────────────────┤
│ • Journey            │
│ • Complaint          │
│ • User               │
└──────────────────────┘
```

---

## 🔧 Key Features Implemented

### Section 1: Header
- ✅ Passenger name display
- ✅ Verified mobile number
- ✅ Notification bell with badge
- ✅ GPS toggle button (ON/OFF)

### Section 2: Active Journey
- ✅ Vehicle number with status badge
- ✅ Route (From → To)
- ✅ Travel time/duration
- ✅ Driver/Conductor names
- ✅ Current stop location

### Section 3: Primary Button
- ✅ Red "I LEFT SOMETHING" button
- ✅ Always visible and prominent
- ✅ Opens complaint modal

### Section 4: Complaint Creation
- ✅ Item type dropdown
- ✅ Description field
- ✅ Photo upload capability
- ✅ Auto-fill location, time, vehicle, route
- ✅ GPS and timestamp capture

### Section 5: Status Tracker
- ✅ Visual progress bar (5 states)
- ✅ Status indicators (🟡🔵🟢📍✅)
- ✅ Real-time status updates

### Section 6: Live Tracking
- ✅ Map placeholder with staff location
- ✅ Meeting point display
- ✅ Real-time ETA

### Section 7: Messages
- ✅ Chat-style interface
- ✅ Staff communication
- ✅ Timestamp on messages

### Section 8: QR Code
- ✅ QR code display
- ✅ Scan button
- ✅ Item collection verification

### Section 9: History
- ✅ Past complaints list
- ✅ Status indicators
- ✅ View all modal
- ✅ Date and vehicle info

### Section 10: Emergency
- ✅ Emergency call button
- ✅ Helpline access
- ✅ FAQ/Help access

---

## 🧪 Testing Checklist

- [ ] Verify client compiles without errors
- [ ] Test login → dashboard transition
- [ ] Display active journey correctly
- [ ] Create new complaint via modal
- [ ] Auto-fill from journey data
- [ ] View complaint status tracker
- [ ] Check complaint history
- [ ] Test GPS toggle
- [ ] Verify all 10 sections render
- [ ] Test responsive design
- [ ] Verify navigation between sections
- [ ] Test logout functionality

---

## 📝 Environment Variables (.env)

```
# Server
PORT=5000
MONGO_URI=mongodb://localhost:27017/saferide-guardian
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Client (in metro.js or app.json)
EXPO_PUBLIC_API_BASE=http://10.0.2.2:5000/api (Android)
or http://localhost:5000/api (iOS)
```

---

## 🎨 UI/UX Design System

**Colors:**
- Primary Blue: #2563EB
- Success Green: #22C55E
- Danger Red: #EF4444
- Background: #F8FAFC
- Card: #FFFFFF
- Text Dark: #1E293B
- Text Light: #94A3B8

**Components:**
- Cards with rounded corners (12px)
- Touch feedback with opacity
- Icons from @expo/vector-icons
- Modal with slide animation
- ScrollView with auto-scroll

---

## 🚨 Error Handling

- Network errors caught and logged
- User-friendly error messages
- Loading states for async operations
- Modal validation before submission
- Graceful fallbacks for missing data

---

## 🔐 Security Notes

- Email required in X-User-Email header for all requests
- QR codes are unique per complaint
- Complaints associated with user email
- Password stored and verified on backend
- JWT implementation ready for future enhancement

---

## 📞 Support

For implementation details, see:
- `SETUP_GUIDE.md` - Installation & testing
- `API_DOCUMENTATION.md` - Endpoint reference
- Code comments in PassengerDashboard.js
