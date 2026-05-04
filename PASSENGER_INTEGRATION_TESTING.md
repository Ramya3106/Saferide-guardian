# Passenger Communication - Integration & Testing Guide

## Feature Overview

The Passenger Communication feature enables real-time, bidirectional messaging between passengers and assigned officers. It builds on the existing officer actions infrastructure and uses the same socket.io architecture for real-time updates.

**Key Components:**
1. **Backend API:** Enhanced passenger.js message endpoints
2. **Frontend Component:** PassengerMessageThread.js chat interface
3. **Real-Time:** Socket.io passenger:message and complaint:new-message events
4. **Data Storage:** ComplaintReply collection for persistent message history

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Message Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │ Officer Dashboard│              │Passenger Dashboard│         │
│  │                  │              │                  │         │
│  │ ComplaintDetail  │              │PassengerMsgThread│         │
│  │ - Reply button   │──Reply──────▶│ - Message input  │         │
│  │ - Action buttons │              │ - Send button    │         │
│  └────────────┬─────┘              └────────┬─────────┘         │
│               │                             │                    │
│               └─────────────┬───────────────┘                    │
│                             │                                    │
│                    Socket.io Connection                          │
│                    (passenger:message)                           │
│                             │                                    │
│                             ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  Backend Server  │                          │
│                   │                  │                          │
│                   │ POST /messages/id│                          │
│                   │ GET /messages/id │                          │
│                   │                  │                          │
│                   │ ComplaintReply   │                          │
│                   │ Database Storage │                          │
│                   └──────────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
Saferide-guardian/
├── server/src/routes/
│   ├── passenger.js              ✅ UPDATED: GET/POST /messages endpoints
│   └── complaints.js             ✅ Already integrated (accept, respond)
│
├── server/src/models/
│   ├── ComplaintReply.js         ✅ Already has visibleToPassenger, messageType
│   └── Complaint.js              ✅ Already has messages array
│
├── client/
│   ├── PassengerDashboard.js     ✅ UPDATED: Imports PassengerMessageThread
│   │                                        Socket listener for passenger:message
│   │
│   └── src/screens/
│       └── PassengerMessageThread.js    ✅ EXISTING: Full chat component
│
└── PASSENGER_MESSAGING_API.md    ✅ NEW: Complete API documentation
```

---

## Implementation Checklist

### Phase 1: Officer Actions (✅ COMPLETED)
- [x] POST /api/staff/respond/:id creates ComplaintReply with visibleToPassenger:true
- [x] PATCH /api/staff/accept/:id creates system notification (messageType:"system")
- [x] Socket events emit to passenger:message room
- [x] ComplaintReply model includes all required fields
- [x] OfficerDetailView has Reply button and modal

### Phase 2: Passenger Communication (✅ COMPLETED)
- [x] GET /api/passenger/messages/:id fetches ComplaintReply filtered by visibleToPassenger
- [x] POST /api/passenger/messages/:id creates passenger message record
- [x] Socket event emitted when passenger sends message
- [x] PassengerMessageThread component integrated into dashboard
- [x] PassengerDashboard listens for passenger:message events
- [x] Real-time message updates in UI

---

## Testing Scenarios

### Scenario 1: Officer Accepts Complaint

**Setup:**
1. Start backend server: `npm start` (in server/ directory)
2. Start frontend: `expo start` (in client/ directory)
3. Create a test complaint from passenger app

**Test Steps:**
1. Login as officer
2. Find the test complaint in list
3. Click "Accept" button
4. Verify passenger receives notification

**Expected Results:**
```
✓ POST /api/staff/accept/:id returns 200
✓ ComplaintReply created with messageType:"system"
✓ Passenger receives socket event: passenger:message
✓ PassengerDashboard merges data
✓ PassengerMessageThread shows system message
  "Your complaint has been accepted by on-duty {role} officer."
```

**Database Check:**
```javascript
db.complaintReplies.findOne({ complaintId: ObjectId("..."), messageType: "system" })
// Should return message from officer
```

---

### Scenario 2: Officer Sends Follow-Up Message

**Setup:**
1. Same as above (complaint accepted)
2. Officer viewing complaint detail

**Test Steps:**
1. Officer clicks "Reply" button in complaint detail
2. Types message: "We've located your bag near lost & found"
3. Clicks "Send"
4. Verify passenger sees message in real-time

**Expected Results:**
```
✓ POST /api/staff/respond/:id returns 200
✓ ComplaintReply created with messageType:"officer-reply"
✓ complaint.messages array updated with timeline entry
✓ Socket event passenger:message emitted
✓ Passenger sees message immediately (no refresh needed)
✓ Message shows officer name and role
✓ Timestamp formats correctly
```

**Test via curl:**
```bash
curl -X POST http://localhost:5000/api/staff/respond/COMPLAINT_ID \
  -H "Content-Type: application/json" \
  -H "x-user-email: officer@example.com" \
  -H "x-user-role: TTR" \
  -H "x-duty-unit: TTR" \
  -H "x-professional-id: P123" \
  -d '{"message": "We found your bag"}'
```

---

### Scenario 3: Passenger Sends Reply Message

**Setup:**
1. Same as above (officer sent message)
2. Passenger viewing complaint detail
3. PassengerMessageThread visible with officer's message

**Test Steps:**
1. Passenger types in message input: "Thanks! How can I collect it?"
2. Clicks send button
3. Message appears immediately in chat (optimistic UI)
4. Verify API call succeeds
5. Switch to officer dashboard, verify message appears

**Expected Results:**
```
✓ Message appears in UI immediately (optimistic)
✓ POST /api/passenger/messages/:id returns 200
✓ ComplaintReply created with messageType:"passenger-message"
✓ complaint.messages updated
✓ Socket event passenger:message emitted (for sync across windows)
✓ Socket event complaint:new-message emitted (officer notification)
✓ Officer sees new message badge on complaint
✓ Message visible in officer's complaint detail when clicked
```

**Test via curl:**
```bash
curl -X POST http://localhost:5000/api/passenger/messages/COMPLAINT_ID \
  -H "Content-Type: application/json" \
  -H "x-user-email: passenger@example.com" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"text": "Thanks! How can I collect it?"}'
```

---

### Scenario 4: Real-Time Synchronization

**Setup:**
1. Open passenger complaint detail on Device A (iPad/Tablet)
2. Open same complaint on Device B (Phone)
3. Officer sends message

**Test Steps:**
1. Officer sends message from desktop
2. Verify message appears on Device A within 1 second
3. Verify message appears on Device B within 1 second
4. No page refresh needed on either device

**Expected Results:**
```
✓ Both devices receive socket event simultaneously
✓ Both UIs update in real-time
✓ No duplicate messages displayed
✓ Message order consistent across devices
✓ Timestamps synchronized
```

---

### Scenario 5: Message History Persistence

**Setup:**
1. Exchange multiple messages between officer and passenger
2. Close passenger app completely

**Test Steps:**
1. Reopen passenger app
2. Navigate to same complaint
3. View message thread

**Expected Results:**
```
✓ GET /api/passenger/messages/:id returns all historical messages
✓ Messages displayed in chronological order
✓ Complete conversation visible (system, officer, passenger messages)
✓ No messages lost
✓ Timestamps accurate
✓ Officer names and roles preserved
```

**Database Check:**
```javascript
// Verify messages in ComplaintReply
db.complaintReplies.find({ 
  complaintId: ObjectId("..."),
  visibleToPassenger: true 
}).sort({ repliedAt: 1 })

// Should show messages in order:
// 1. System: Officer accepted
// 2. Officer-reply: We found your bag
// 3. Passenger-message: Thanks! How can I collect it?
```

---

### Scenario 6: Internal Notes Not Visible to Passenger

**Setup:**
1. Officer writes an internal note while investigating
2. Passenger has complaint detail open

**Test Steps:**
1. Officer adds internal note: "Need to verify with station master"
2. Verify passenger does NOT see this note
3. Verify other passengers also can't see this note

**Expected Results:**
```
✓ POST /api/staff/note/:id creates ComplaintReply with isInternalNote:true
✓ GET /api/passenger/messages/:id filters out isInternalNote messages
✓ Passenger message thread is clean of internal discussion
✓ Officer can still see internal notes in their dashboard
```

---

### Scenario 7: Closed Complaint - No New Messages

**Setup:**
1. Officer closes complaint (status = "Closed")
2. Passenger viewing complaint detail

**Test Steps:**
1. Passenger tries to send message
2. Input field should be disabled
3. Verify error message or disabled state
4. Verify message is NOT sent to backend

**Expected Results:**
```
✓ Input field disabled when status is "Closed"
✓ Send button visually disabled (grayed out)
✓ No API call made when user tries to type/send
✓ User-friendly message: "Complaint is closed"
```

---

## Frontend Integration Verification

### Check 1: PassengerDashboard Imports

**File:** client/PassengerDashboard.js

```javascript
// Line 24: Import should exist
import PassengerMessageThread from "./src/screens/PassengerMessageThread";
```

**Verify:**
```bash
grep -n "import PassengerMessageThread" client/PassengerDashboard.js
# Should return: 24:import PassengerMessageThread from ...
```

---

### Check 2: Socket Listener

**File:** client/PassengerDashboard.js

```javascript
// Around line 353: Should have listener for passenger:message
socket.on("passenger:message", (payload) => {
  if (payload?.complaintId) {
    mergeComplaintRecord(payload);
  }
});
```

**Verify:**
```bash
grep -n "passenger:message" client/PassengerDashboard.js
# Should return the listener setup
```

---

### Check 3: Component Rendering

**File:** client/PassengerDashboard.js

```javascript
// Around line 1095: renderStaffMessages should use component
return (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>💬 Staff Messages</Text>
    <PassengerMessageThread
      complaint={currentComplaint}
      userEmail={userEmail}
      userName={userName}
      onMessageSent={handleMessageSent}
      apiBase={API_BASE}
      authToken={authToken}
    />
  </View>
);
```

**Verify:**
```bash
grep -A 10 "const renderStaffMessages" client/PassengerDashboard.js
# Should show PassengerMessageThread component usage
```

---

## Backend Verification

### Check 1: Message Endpoints

**File:** server/src/routes/passenger.js

```javascript
// GET endpoint at line ~1028
router.get("/messages/:complaintId", async (req, res) => {
  // Should fetch ComplaintReply with visibleToPassenger:true
  const complaintReplies = await ComplaintReply.find({
    complaintId: complaint._id,
    visibleToPassenger: true,
  }).sort({ repliedAt: 1 });
  // ... rest of implementation
});

// POST endpoint at line ~1070
router.post("/messages/:complaintId", async (req, res) => {
  // Should create ComplaintReply with messageType:"passenger-message"
  const passengerReply = await ComplaintReply.create({
    complaintId: complaint._id,
    messageType: "passenger-message",
    // ... rest of implementation
  });
  // ... rest of implementation
});
```

**Verify:**
```bash
grep -n "router.post\|router.get" server/src/routes/passenger.js | grep messages
# Should show both GET and POST for /messages
```

---

### Check 2: Socket Events

**File:** server/src/routes/passenger.js

```javascript
// POST /messages should emit:
emitSocketEvent("passenger:message", {
  complaintId: String(complaint._id),
  passengerId: complaint.passengerId,
  // ...
});

emitSocketEvent("complaint:new-message", {
  complaintId: String(complaint._id),
  // ...
});
```

**Verify:**
```bash
grep -n "emitSocketEvent" server/src/routes/passenger.js | tail -20
# Should see passenger:message and complaint:new-message events
```

---

## Quick Testing Commands

### Start Development Servers

```bash
# Terminal 1: Backend
cd server
npm install
npm start
# Should log: "Server running on port 5000"

# Terminal 2: Frontend
cd client
expo start
# Should show: "Press a - android, i - ios, w - web"
```

---

### Test GET Messages Endpoint

```bash
# Get messages for a complaint
curl -X GET "http://localhost:5000/api/passenger/messages/COMPLAINT_ID" \
  -H "x-user-email: passenger@example.com" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

---

### Test POST Messages Endpoint

```bash
# Send a message as passenger
curl -X POST "http://localhost:5000/api/passenger/messages/COMPLAINT_ID" \
  -H "Content-Type: application/json" \
  -H "x-user-email: passenger@example.com" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Thanks for the update!"
  }' | jq
```

---

### View ComplaintReplies in Database

```javascript
// Connect to MongoDB
mongosh

// Switch to saferide database
use saferide

// View all messages for a complaint
db.complaintReplies.find({ 
  complaintId: ObjectId("YOUR_COMPLAINT_ID")
}).pretty()

// View only visible messages
db.complaintReplies.find({
  complaintId: ObjectId("YOUR_COMPLAINT_ID"),
  visibleToPassenger: true
}).pretty()

// Count messages by type
db.complaintReplies.aggregate([
  { $match: { complaintId: ObjectId("YOUR_COMPLAINT_ID") } },
  { $group: { _id: "$messageType", count: { $sum: 1 } } }
])
```

---

## Troubleshooting Common Issues

### Issue: Messages Not Appearing in Real-Time

**Symptoms:**
- Passenger sends message, but officer doesn't see it without refresh
- Or officer sends message, passenger doesn't see it immediately

**Troubleshooting Steps:**
1. Check server logs for socket errors
2. Verify socket.io connection is established:
   ```javascript
   console.log(socket.id); // Should print socket ID
   ```
3. Check that complaint rooms are joined:
   ```javascript
   console.log(socket.rooms); // Should include complaint:{id}
   ```
4. Verify socket events are being emitted:
   ```bash
   grep -n "emitSocketEvent" server/src/routes/passenger.js
   ```

**Solution:**
- Ensure socket.io is properly initialized in both backend and frontend
- Check that passenger:message event is being listened for in PassengerDashboard
- Verify complaint ID is being broadcast correctly

---

### Issue: Passenger Can't Send Messages

**Symptoms:**
- "Message sent successfully" in UI but message doesn't appear
- No error shown to user
- Message not in database

**Troubleshooting Steps:**
1. Check network tab in browser dev tools for failed requests
2. Verify x-user-email header is being sent:
   ```javascript
   console.log(userEmail);
   ```
3. Check backend logs for 401/403 errors
4. Verify passenger email matches complaint.passengerEmail in database

**Solution:**
- Ensure auth headers are properly set in axios request
- Verify user email is correct
- Check complaint ownership in database

---

### Issue: Wrong Messages Displayed

**Symptoms:**
- Internal notes appearing in passenger view
- Messages from other complaints showing
- Duplicate messages

**Troubleshooting Steps:**
1. Check ComplaintReply filtering in GET endpoint:
   ```javascript
   const complaintReplies = await ComplaintReply.find({
     complaintId: complaint._id,
     visibleToPassenger: true, // This is critical
   });
   ```
2. Verify isInternalNote is being checked
3. Check message merging logic in PassengerMessageThread

**Solution:**
- Ensure visibleToPassenger:true filter is applied
- Verify ComplaintReply schema has isInternalNote field
- Check for duplicate messages in state merge logic

---

### Issue: Socket Events Not Being Received

**Symptoms:**
- No real-time updates
- Messages only appear after refresh
- Socket connection shows as connected but no events

**Troubleshooting Steps:**
1. Check socket.io server is initialized:
   ```javascript
   const io = require("socket.io")(server, {...});
   console.log("Socket.io initialized");
   ```
2. Verify socket middleware is set up in complaints.js:
   ```javascript
   const emitSocketEvent = require("../utils/socket.js");
   ```
3. Check socket rooms are being joined:
   ```bash
   grep -n "socket.on.*join" server/src/utils/socket.js
   ```

**Solution:**
- Ensure socket.io instance is passed to routes
- Verify socket middleware is imported and used
- Check that join events are being handled properly

---

## Performance Optimization Tips

1. **Database Indexes:**
   ```javascript
   // Ensure these indexes exist
   db.complaintReplies.createIndex({ complaintId: 1, repliedAt: 1 })
   db.complaintReplies.createIndex({ complaintId: 1, visibleToPassenger: 1 })
   ```

2. **Message Pagination:**
   - For complaints with 100+ messages, implement pagination
   - Add skip/limit parameters to GET /messages endpoint

3. **Socket Room Optimization:**
   - Only broadcast to specific complaint room
   - Don't broadcast to all connected users

4. **Frontend Caching:**
   - Cache messages locally to reduce API calls
   - Use optimistic updates to reduce perceived latency

---

## Next Steps

After testing all scenarios:

1. ✅ Verify all socket events are being broadcast
2. ✅ Confirm real-time sync works across multiple devices
3. ✅ Test with high message volume (100+ messages)
4. ✅ Verify database doesn't duplicate messages
5. ✅ Check message ordering is consistent
6. ✅ Test error scenarios (network disconnect, server restart)
7. ✅ Load test with multiple concurrent users
8. ✅ Review security headers and permissions

Once validated, the passenger communication feature is production-ready!
