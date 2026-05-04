# Passenger Communication - Quick Reference

## 🎯 Feature Goal
Real-time support-chat-like message thread between officers and passengers with instant synchronization.

## 📋 Implementation Status
✅ **COMPLETE** - Both backend API and frontend UI fully integrated

---

## 🏗️ Architecture at a Glance

```
Passenger                    Socket.io                     Officer
┌──────────┐               ┌────────┐                ┌──────────┐
│Dashboard │◄──────────────│ Events │────────────────►│Dashboard │
│ Thread   │  passenger:   │        │  complaint:    │ Detail   │
│ View     │   message     │        │  new-message   │ Reply    │
└──────────┘               └────────┘                └──────────┘
     │                          │                         │
     └──────────────┬───────────┴──────────────┬──────────┘
                    │                          │
                    ▼                          ▼
              Backend Server: Express
              ┌──────────────────────────────┐
              │ GET /api/passenger/messages  │
              │ POST /api/passenger/messages │
              │ POST /api/staff/respond      │
              │ PATCH /api/staff/accept      │
              └──────────────────────────────┘
                    │
                    ▼
              MongoDB Collections
              ┌──────────────────┐
              │ ComplaintReply   │ (persistent messages)
              │ complaint        │ (timeline tracking)
              └──────────────────┘
```

---

## 📁 Files Modified/Created

| File | Status | Changes |
|------|--------|---------|
| `server/src/routes/passenger.js` | ✅ Modified | Enhanced GET/POST /messages endpoints |
| `client/PassengerDashboard.js` | ✅ Modified | Added component import & socket listener |
| `client/src/screens/PassengerMessageThread.js` | ✅ Existing | Full chat UI component |
| `PASSENGER_MESSAGING_API.md` | ✅ Created | Complete API documentation |
| `PASSENGER_INTEGRATION_TESTING.md` | ✅ Created | Testing & troubleshooting guide |
| `FEATURE_5_PASSENGER_COMMUNICATION_SUMMARY.md` | ✅ Created | Implementation summary |

---

## 🔌 API Quick Reference

### GET /api/passenger/messages/:complaintId
Fetch all visible messages in conversation

**Headers:** `x-user-email`, `Authorization: Bearer {token}`

**Returns:** Array of messages with officer/passenger names, timestamps, types

---

### POST /api/passenger/messages/:complaintId
Passenger sends reply message

**Body:** `{ text: "Your message here" }`

**Headers:** `x-user-email`, `Authorization: Bearer {token}`

**Events Emitted:**
- `passenger:message` (sync across windows)
- `complaint:new-message` (officer notification)

---

### POST /api/staff/respond/:id (Existing)
Officer sends reply to passenger

**Body:** `{ message: "Your reply here" }`

**Events Emitted:**
- `passenger:message` (passenger receives in real-time)
- Timeline updated with message entry

---

### PATCH /api/staff/accept/:id (Existing)
Officer accepts complaint

**Events Emitted:**
- `passenger:message` (system notification to passenger)
- Message: "Your complaint has been accepted by on-duty {role} officer."

---

## 🔄 Socket Events

| Event | Direction | Trigger | Payload |
|-------|-----------|---------|---------|
| `passenger:message` | Server → Client | Officer reply, accept, or passenger message | Message details with officer/passenger info |
| `complaint:new-message` | Server → Client | Passenger sends message | Complaint + message + count |

---

## 🎨 UI Components

### PassengerMessageThread
Chat-like interface for passengers

**Location:** `client/src/screens/PassengerMessageThread.js`

**Features:**
- Officer messages: Blue bubble (left)
- Passenger messages: Darker blue bubble (right)
- Auto-scroll to latest
- Relative timestamps
- Input disabled when closed
- Optimistic UI updates

**Props:**
```javascript
complaint={currentComplaint}
userEmail={userEmail}
userName={userName}
onMessageSent={handleMessageSent}
apiBase={API_BASE}
authToken={authToken}
```

---

## 💾 Database Schema

### ComplaintReply Collection
```javascript
{
  complaintId: ObjectId,
  officerId: String,                    // staff ID or "passenger"
  officerName: String,
  officerRole: String,                  // TTR, RPF, Police, Passenger
  message: String,                      // Message text
  statusUpdate: String,                 // Current complaint status
  visibleToPassenger: Boolean,          // true = passenger sees it
  messageType: String,                  // system, officer-reply, passenger-message
  repliedAt: Date,                      // Timestamp
  createdAt: Date,                      // Auto
  updatedAt: Date                       // Auto
}
```

**Indexes:**
- `(complaintId, repliedAt)` - Fast chronological retrieval
- `(complaintId, visibleToPassenger, repliedAt)` - Filtered retrieval

### Complaint.messages Array (Timeline)
```javascript
{
  staffId: String,
  staffName: String,
  text: String,
  timestamp: Date,
  isInternalNote: Boolean,              // Internal only
  isPassengerMessage: Boolean           // From passenger
}
```

---

## 🔐 Security Features

✅ Passenger authorization on all endpoints
✅ Message visibility filtering (visibleToPassenger flag)
✅ Internal notes hidden from passengers
✅ Bearer token validation
✅ Email verification
✅ Complete audit trail

---

## 📊 Message Types

| Type | visibleToPassenger | Use |
|------|---|---|
| `system` | true | Acceptance notification |
| `officer-reply` | true | Officer message to passenger |
| `passenger-message` | true | Passenger reply |
| `internal-note` | false | Officer working notes |
| `status-update` | true | Status change notification |

---

## ✅ Testing Quick Start

### Prerequisites
```bash
# Backend running
cd server && npm start

# Frontend running
cd client && expo start
```

### Test Scenario 1: Officer Accepts
1. Officer: Finds complaint, clicks "Accept"
2. Passenger: Sees system message "Your complaint has been accepted"

### Test Scenario 2: Officer Sends Reply
1. Officer: Clicks "Reply", types message, sends
2. Passenger: Sees message in real-time (no refresh needed)

### Test Scenario 3: Passenger Replies
1. Passenger: Types message in input field, clicks send
2. Officer: Receives socket event "complaint:new-message"

### Test Scenario 4: Message History
1. Passenger: Closes and reopens app
2. Passenger: Sees all historical messages still there

---

## 🐛 Troubleshooting Quick Links

**Messages not real-time?**
- Check socket.io connection: `socket.id` should print socket ID
- Verify `passenger:message` listener in PassengerDashboard
- Check server logs for socket emission

**Passenger can't send?**
- Verify `x-user-email` header matches complaint owner
- Check POST request is going to correct endpoint
- Look for 401/403 errors in network tab

**Wrong messages showing?**
- Ensure `visibleToPassenger: true` filter is applied
- Check for `isInternalNote: true` exclusion
- Verify ComplaintId in database

**See full troubleshooting:** PASSENGER_INTEGRATION_TESTING.md

---

## 📈 Performance Optimization

**Database Indexes:**
```javascript
db.complaintReplies.createIndex({ complaintId: 1, repliedAt: 1 })
db.complaintReplies.createIndex({ complaintId: 1, visibleToPassenger: 1, repliedAt: 1 })
```

**Best Practices:**
- Paginate messages for complaints with 100+ messages
- Only broadcast to specific complaint rooms
- Use optimistic UI for instant feedback
- Cache messages locally on client

---

## 🚀 Deployment Checklist

- [ ] Database indexes created
- [ ] ComplaintReply schema validates
- [ ] All 7 test scenarios pass
- [ ] Socket events broadcast properly
- [ ] Error handling tested
- [ ] Authorization working
- [ ] Message ordering correct
- [ ] Real-time sync verified
- [ ] Load tested with 100+ messages
- [ ] iOS and Android tested

---

## 📚 Complete Documentation

1. **API Reference:** `PASSENGER_MESSAGING_API.md`
2. **Testing Guide:** `PASSENGER_INTEGRATION_TESTING.md`
3. **Feature Summary:** `FEATURE_5_PASSENGER_COMMUNICATION_SUMMARY.md`

---

## 🎓 Key Code Patterns

### Getting Messages (Frontend)
```javascript
const response = await axios.get(
  `${API_BASE}/passenger/messages/${complaintId}`,
  { headers: { "x-user-email": userEmail, Authorization: `Bearer ${token}` } }
);
const messages = response.data.data.messages;
```

### Sending Message (Frontend)
```javascript
const response = await axios.post(
  `${API_BASE}/passenger/messages/${complaintId}`,
  { text: messageText },
  { headers: { "x-user-email": userEmail, Authorization: `Bearer ${token}` } }
);
```

### Fetching Messages (Backend)
```javascript
const complaintReplies = await ComplaintReply.find({
  complaintId: complaint._id,
  visibleToPassenger: true
}).sort({ repliedAt: 1 });
```

### Emitting Socket Event (Backend)
```javascript
emitSocketEvent("passenger:message", {
  complaintId: String(complaint._id),
  passengerId: complaint.passengerId,
  senderName: currentOfficer.staffName,
  senderRole: currentOfficer.dutyUnit,
  messageText: message.text,
  source: "officer-respond"
});
```

### Listening for Socket Event (Frontend)
```javascript
socket.on("passenger:message", (payload) => {
  if (payload?.complaintId) {
    setComplaints(prev => {
      // Merge new message into complaints list
      return updated;
    });
  }
});
```

---

## 🔗 Integration Points

- **Feature 4 (Officer Actions):** Uses respond endpoint and accept endpoint
- **Real-Time (Socket.io):** Broadcasts passenger:message events
- **Status Flow:** Messages track current complaint status
- **Dashboard:** PassengerDashboard renders message thread

---

## 📞 Support

**For questions or issues:**
1. Check `PASSENGER_INTEGRATION_TESTING.md` troubleshooting section
2. Review `PASSENGER_MESSAGING_API.md` for endpoint details
3. Check server logs for socket/database errors
4. Verify database indexes are created

---

**Last Updated:** Current Session
**Feature Status:** ✅ Complete and Ready for Testing
