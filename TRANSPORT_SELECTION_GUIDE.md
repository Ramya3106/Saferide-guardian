# Transport Selection & Dynamic Form Implementation

## 🚀 Feature Overview

The "Report Lost Item" feature now includes a **two-step process**:

### Step 1: Transport Selection
Passengers select which transport they lost their item in:
- 🚆 Train
- 🚗 Car  
- 🚌 Bus
- 🛺 Auto

### Step 2: Dynamic Form
Based on the transport selected, the form dynamically shows appropriate fields.

---

## 📱 User Flow

```
1. User clicks "I LEFT SOMETHING" button
   ↓
2. Modal opens: "In which transport did you lose your item?"
   ↓
3. User selects one of 4 transport options
   ↓
4. Dynamic form appears with transport-specific fields
   ↓
5. User fills in:
   - Vehicle Number (Train/Car/Bus/Auto Number)
   - Item Type (Bag/Mobile/Wallet/Documents)
   - Item Description
   - From Location/Station
   - To Location/Station
   - Departure Time
   - Arrival Time
   - Upload Photo (optional)
   ↓
6. Auto-captured details shown:
   - Current location
   - Timestamp
   ↓
7. User clicks submit button (customized per transport):
   - Train → "Submit to TTR / RPF"
   - Car → "Submit to Car Driver"
   - Bus → "Submit to Driver / Conductor"
   - Auto → "Submit to Auto Driver"
   ↓
8. Success message: "Request submitted successfully to [Authority]!"
```

---

## 🎨 UI Components

### Transport Selection Screen (Step 1)

**Title:** "In which transport did you lose your item?"

**4 Transport Buttons (2x2 Grid):**
```
┌─────────────┬─────────────┐
│  🚆 Train   │   🚗 Car    │
│   [Icon]    │   [Icon]    │
└─────────────┴─────────────┘
┌─────────────┬─────────────┐
│  🚌 Bus     │  🛺 Auto    │
│   [Icon]    │   [Icon]    │
└─────────────┴─────────────┘
```

**Design:**
- Light blue background (#F0F9FF)
- Blue border (#BFDBFE)
- Large icons (40px)
- Responsive touch feedback

---

### Dynamic Form (Step 2)

**Header:**
- Title: "Lost Item - [TRANSPORT TYPE]"
- Back button: "← Change Transport"
- Close button: "×"

**Form Fields (Common to all transports):**

1. **Vehicle Number** (labeled based on transport)
   - Train: "🚆 Train Number"
   - Car: "🚗 Car Number"
   - Bus: "🚌 Bus Number"
   - Auto: "🛺 Auto Number"

2. **Item Type**
   - Dropdown/Input: Bag / Mobile / Wallet / Documents

3. **Item Description**
   - Multi-line text area
   - Placeholder: "Color, brand, contents..."

4. **From Location** (labeled based on transport)
   - Train: "🚉 From Station"
   - Others: "📍 From Location"

5. **To Location**
   - Train: "🚉 To Station"
   - Others: "📍 To Location"

6. **Departure Time**
   - Time input
   - Example: "10:30 AM"

7. **Arrival Time**
   - Time input
   - Example: "12:45 PM"

8. **Auto-captured Details Box**
   - Blue highlighted section
   - Shows: Current location, timestamp

9. **Upload Photo Button** (Optional)
   - Camera icon
   - "📸 Upload Item Photo (Optional)"

10. **Submit Button** (Dynamic label)
    - Train: "➡️ Submit to TTR / RPF"
    - Car: "➡️ Submit to Car Driver"
    - Bus: "➡️ Submit to Driver / Conductor"
    - Auto: "➡️ Submit to Auto Driver"

---

## 💾 Data Structure

### New State Variables Added:

```javascript
// Transport selection
transportType: null // 'train', 'car', 'bus', 'auto'
modalStep: 1        // 1 = transport selection, 2 = form

// Form fields
vehicleNumber: ""
itemType: ""
description: ""
fromLocation: ""
toLocation: ""
departureTime: ""
arrivalTime: ""
photoUri: null
```

### API Request Format:

```json
{
  "transportType": "train",
  "vehicleNumber": "12345 Chennai Express",
  "itemType": "Bag",
  "description": "Black backpack with laptop",
  "fromLocation": "Chennai Central",
  "toLocation": "Coimbatore Junction",
  "departureTime": "10:30 AM",
  "arrivalTime": "4:45 PM",
  "route": "Chennai Central → Coimbatore Junction",
  "submitAuthority": "TTR / RPF",
  "timestamp": "2024-02-09T10:30:00Z",
  "lastSeenLocation": "Chennai Central"
}
```

---

## 🔄 Backend Changes

### Updated Complaint Model
Added new fields to `server/src/models/Complaint.js`:

```javascript
{
  transportType: {
    type: String,
    enum: ["train", "car", "bus", "auto"],
    default: "bus"
  },
  fromLocation: String,
  toLocation: String,
  departureTime: String,
  arrivalTime: String,
  submitAuthority: String
}
```

### Updated Journey Model
Added transport type to `server/src/models/Journey.js`:

```javascript
{
  transportType: {
    type: String,
    enum: ["train", "car", "bus", "auto"],
    default: "bus"
  }
}
```

### Updated API Endpoint
`POST /api/passenger/complaints` now accepts additional fields:
- transportType
- fromLocation
- toLocation
- departureTime
- arrivalTime
- submitAuthority

---

## 🎯 Key Functions

### `handleTransportSelect(type)`
- Called when user selects a transport
- Sets `transportType` state
- Advances to step 2 (`modalStep = 2`)

### `resetComplaintModal()`
- Resets all form fields
- Closes modal
- Returns to step 1

### `handleCreateComplaint()`
- Validates required fields
- Posts complaint to backend
- Shows success message with specific authority

### `getSubmitAuthority(type)`
Returns appropriate authority based on transport:
```javascript
train → "TTR / RPF"
car   → "Car Driver"
bus   → "Driver / Conductor"
auto  → "Auto Driver"
```

### `getTransportIcon(type)`
Returns correct Ionicon name for each transport

---

## ✨ New Styles Added

```javascript
questionText: {
  fontSize: 18,
  fontWeight: "700",
  textAlign: "center",
  marginBottom: 24,
}

transportGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 12,
}

transportButton: {
  width: "48%",
  backgroundColor: "#F0F9FF",
  borderWidth: 2,
  borderColor: "#BFDBFE",
  borderRadius: 12,
  padding: 20,
  minHeight: 120,
}

backButton: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
}
```

---

## 🧪 Testing Checklist

### Manual Testing Steps:

1. **Transport Selection**
   - [ ] Click "I LEFT SOMETHING" button
   - [ ] Verify 4 transport buttons appear
   - [ ] Tap each transport option
   - [ ] Verify form advances to step 2

2. **Train Form**
   - [ ] Click "🚆 Train"
   - [ ] Verify label shows "Train Number"
   - [ ] Fill all fields
   - [ ] Verify submit shows "Submit to TTR / RPF"
   - [ ] Submit and verify success message

3. **Car Form**
   - [ ] Click "🚗 Car"
   - [ ] Verify label shows "Car Number"
   - [ ] Submit shows "Submit to Car Driver"

4. **Bus Form**
   - [ ] Click "🚌 Bus"
   - [ ] Verify label shows "Bus Number"
   - [ ] Submit shows "Submit to Driver / Conductor"

5. **Auto Form**
   - [ ] Click "🛺 Auto"
   - [ ] Verify label shows "Auto Number"
   - [ ] Submit shows "Submit to Auto Driver"

6. **Back Navigation**
   - [ ] Click "← Change Transport"
   - [ ] Verify returns to transport selection
   - [ ] Form data is reset

7. **Validation**
   - [ ] Try submitting empty form
   - [ ] Verify error message appears
   - [ ] Fill required fields only
   - [ ] Verify submission works

8. **Auto-fill Section**
   - [ ] Verify current location appears
   - [ ] Verify timestamp updates

9. **Photo Upload**
   - [ ] Click "Upload Photo"
   - [ ] Verify alert/camera intent (when implemented)

10. **Modal Close**
    - [ ] Click × button
    - [ ] Verify modal closes
    - [ ] Verify state resets

---

## 📊 Success Metrics

After implementation:
- ✅ User can select transport type
- ✅ Form dynamically adjusts labels
- ✅ Different submit authorities per transport
- ✅ Validation prevents incomplete submissions
- ✅ Success message confirms submission
- ✅ Back navigation allows correction
- ✅ Auto-fill reduces manual entry
- ✅ Photo upload ready (placeholder)
- ✅ Clean modal reset on close

---

## 🚧 Future Enhancements

1. **Item Type Dropdown**
   - Replace text input with actual dropdown/picker
   - Pre-defined options: Bag, Mobile, Wallet, Documents, Other

2. **Time Picker**
   - Replace text input with native time picker
   - Better UX for departure/arrival times

3. **Photo Upload**
   - Implement camera/gallery access
   - Image compression and upload
   - Preview uploaded photos

4. **Location Autocomplete**
   - Google Places API integration
   - Station name autocomplete for trains
   - Common stop suggestions for buses

5. **Real-time Tracking**
   - Connect to actual GPS location
   - Auto-fill last known location

6. **Form Validation**
   - Vehicle number format validation
   - Time range validation
   - Required field highlighting

7. **Submit Confirmation**
   - Review screen before final submit
   - Edit capability before submission

---

## 📱 Screenshots Reference

### Step 1: Transport Selection
[Screen shows 4 large buttons in 2x2 grid with icons]

### Step 2: Train Form
[Screen shows form with "Train Number", "From Station", "To Station", etc.]

### Step 2: Car Form
[Screen shows form with "Car Number", "From Location", "To Location", etc.]

### Success Message
[Alert: "Request submitted successfully to TTR / RPF!"]

---

## 🔗 Related Files

**Frontend:**
- `client/PassengerDashboard.js` - Main component with modal and forms

**Backend:**
- `server/src/models/Complaint.js` - Updated complaint schema
- `server/src/models/Journey.js` - Updated journey schema
- `server/src/routes/passenger.js` - Updated POST /complaints endpoint

---

## 📞 Support

For issues or questions:
- Check console logs for errors
- Verify all dependencies installed
- Ensure backend is running
- Test API endpoints with Postman
