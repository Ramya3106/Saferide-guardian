# Passenger Messaging & Communication API

## Overview

The Passenger Messaging system enables real-time, two-way communication between passengers and assigned officers. Officers can send replies to complaints, and passengers can respond with follow-up messages. All messages are timestamped, organized chronologically, and delivered in real-time via Socket.io.

## Message Model Architecture

### ComplaintReply Collection
Stores all passenger-visible messages and officer responses.

```javascript
{
  _id: ObjectId,
  complaintId: ObjectId,        // Reference to complaint
  officerId: String,            // Staff ID or "passenger" for passenger messages
  officerName: String,          // Name of officer or passenger name
  officerRole: String,          // "TTR", "RPF", "Police", or "Passenger"
  message: String,              // Message text content
  statusUpdate: String,         // Current complaint status
  visibleToPassenger: Boolean,  // true = passenger can see, false = internal only
  messageType: String,          // "system" | "officer-reply" | "passenger-message"
  repliedAt: Date,              // Timestamp of message
  createdAt: Date,              // Auto-created by schema
  updatedAt: Date               // Auto-updated by schema
}
```

**Indexes:**
- `(complaintId, repliedAt)` - Fast retrieval by complaint, sorted by time
- `(complaintId, visibleToPassenger, repliedAt)` - Filtered retrieval for passenger messages

### Complaint.messages Array
Timeline entries created for internal tracking of all officer actions.

```javascript
{
  staffId: String,          // Officer staff ID
  staffName: String,        // Officer name
  text: String,             // Message or action description
  timestamp: Date,          // When action occurred
  isInternalNote: Boolean,  // true = officer only, false = passenger visible
  isPassengerMessage: Boolean // true = message from passenger
}
```

## API Endpoints

### GET /api/passenger/messages/:complaintId
Fetch all visible messages in a conversation thread.

**Authentication:**
- Header: `x-user-email` (must match complaint's passengerEmail)
- Header: `Authorization: Bearer {token}`

**Response (Success - 200):**
```javascript
{
  success: true,
  statusCode: 200,
  message: "Messages retrieved successfully",
  data: {
    complaintId: "507f1f77bcf86cd799439011",
    staffName: "Officer Sharma",
    staffRole: "TTR",
    status: "In Review",
    messages: [
      {
        id: "507f191e810c19729de860ea",
        type: "system",
        sender: "Officer Sharma",
        senderRole: "TTR",
        text: "Your complaint has been accepted by an on-duty TTR officer.",
        timestamp: "2024-01-15T10:30:00Z",
        isOfficer: true
      },
      {
        id: "507f191e810c19729de860eb",
        type: "officer-reply",
        sender: "Officer Sharma",
        senderRole: "TTR",
        text: "We've located your bag near the lost & found.",
        timestamp: "2024-01-15T10:45:00Z",
        isOfficer: true
      },
      {
        id: "507f191e810c19729de860ec",
        type: "passenger-message",
        sender: "Raj Patel",
        senderRole: "Passenger",
        text: "That's great! How can I collect it?",
        timestamp: "2024-01-15T10:50:00Z",
        isOfficer: false
      }
    ],
    total: 3
  }
}
```

**Response (Error - 404):**
```javascript
{
  success: false,
  statusCode: 404,
  message: "Complaint not found",
  code: "NOT_FOUND"
}
```

---

### POST /api/passenger/messages/:complaintId
Send a message to the assigned officer.

**Authentication:**
- Header: `x-user-email` (must match complaint's passengerEmail)
- Header: `Authorization: Bearer {token}`

**Request Body:**
```javascript
{
  text: "That's great! How can I collect it?"  // Required, non-empty string
}
```

**Response (Success - 200):**
```javascript
{
  success: true,
  statusCode: 200,
  message: "Message sent successfully",
  data: {
    complaint: {
      _id: "507f1f77bcf86cd799439011",
      complaintId: "C123456",
      passengerEmail: "raj@example.com",
      status: "In Review",
      messages: [
        // Updated complaint timeline array
        {
          staffId: "passenger",
          staffName: "Raj Patel",
          text: "That's great! How can I collect it?",
          timestamp: "2024-01-15T10:50:00Z",
          isPassengerMessage: true
        }
      ]
    },
    message: {
      _id: "507f191e810c19729de860ec",
      complaintId: "507f1f77bcf86cd799439011",
      officerId: "passenger",
      officerName: "Raj Patel",
      officerRole: "Passenger",
      message: "That's great! How can I collect it?",
      statusUpdate: "In Review",
      visibleToPassenger: true,
      messageType: "passenger-message",
      repliedAt: "2024-01-15T10:50:00Z"
    }
  }
}
```

**Response (Error - 400):**
```javascript
{
  success: false,
  statusCode: 400,
  message: "Message text required",
  code: "VALIDATION_ERROR"
}
```

---

## Socket Events

### passenger:message (Broadcasting)

**Emitted by:**
- Officer responds to complaint (POST /api/staff/respond)
- Officer accepts complaint (PATCH /api/staff/accept)
- Passenger sends message (POST /api/passenger/messages/:id)

**Event Payload:**
```javascript
{
  complaintId: "507f1f77bcf86cd799439011",
  passengerId: "pass_123",
  senderName: "Officer Sharma" | "Raj Patel",
  senderRole: "TTR" | "Passenger",
  messageText: "Your complaint has been accepted...",
  message: {
    _id: "507f191e810c19729de860ea",
    complaintId: "507f1f77bcf86cd799439011",
    officerId: "staff_123",
    officerName: "Officer Sharma",
    officerRole: "TTR",
    message: "Your complaint has been accepted...",
    messageType: "system" | "officer-reply" | "passenger-message",
    repliedAt: "2024-01-15T10:30:00Z"
  },
  source: "officer-accept" | "officer-respond" | "passenger-message"
}
```

**Recipient:** Passengers listening on their passenger room
**Handler:** PassengerDashboard.js merges complaint data and updates state

---

### complaint:new-message (Broadcasting)

**Emitted by:** Passenger sends message (POST /api/passenger/messages/:id)

**Event Payload:**
```javascript
{
  complaintId: "507f1f77bcf86cd799439011",
  passengerId: "pass_123",
  complaint: { /* full complaint object */ },
  message: {
    staffId: "passenger",
    staffName: "Raj Patel",
    text: "That's great! How can I collect it?",
    timestamp: "2024-01-15T10:50:00Z",
    isPassengerMessage: true
  },
  messageCount: 3,
  source: "passenger-message"
}
```

**Recipient:** Officers listening on complaint room (officer:listen)
**Handler:** OfficerDashboard receives notification that passenger replied

---

## Real-Time Communication Flow

### Officer Sends Reply → Passenger Receives

```
┌─────────────────────────────────────────────────────────────┐
│ Officer (OfficerDashboard)                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Clicks "Reply" button                                     │
│ 2. Enters message: "We've found your bag"                    │
│ 3. Submits form                                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        POST /api/staff/respond/:id
        Body: { message: "We've found your bag" }
        
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   Backend Action:              Socket Broadcast:
   ├─ Create ComplaintReply     emit "passenger:message" to
   │  (visibleToPassenger:true)  passenger room
   ├─ Update complaint.messages
   ├─ Create action log         
   └─ Save to DB
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Passenger (PassengerDashboard)                               │
├──────────────────────────────────────────────────────────────┤
│ 1. Socket listener receives "passenger:message" event        │
│ 2. mergeComplaintRecord() updates complaint state            │
│ 3. PassengerMessageThread re-renders                         │
│ 4. New message appears in chat                               │
│ 5. Auto-scroll shows latest message                          │
└──────────────────────────────────────────────────────────────┘
```

### Passenger Sends Reply → Officer Receives

```
┌──────────────────────────────────────────────────────────────┐
│ Passenger (PassengerMessageThread)                            │
├──────────────────────────────────────────────────────────────┤
│ 1. Types message: "How can I collect it?"                    │
│ 2. Presses send button                                       │
│ 3. Optimistic UI: message appears immediately               │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
     POST /api/passenger/messages/:id
     Body: { text: "How can I collect it?" }
     Headers: x-user-email, Authorization
     
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   Backend Action:              Socket Broadcast:
   ├─ Create ComplaintReply      emit "complaint:new-message" to
   │  (messageType: passenger)    complaint room (officers)
   ├─ Update complaint.messages
   ├─ Verify passenger ownership  emit "passenger:message" to
   └─ Save to DB                  passenger room (sync)
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Officer (OfficerDashboard)                                    │
├──────────────────────────────────────────────────────────────┤
│ 1. Socket listener receives "complaint:new-message" event    │
│ 2. Updates complaint in list                                 │
│ 3. Shows notification: "Passenger replied"                   │
│ 4. New message visible in complaint detail view              │
└──────────────────────────────────────────────────────────────┘
```

---

## Frontend Components

### PassengerMessageThread.js
Displays real-time chat-like interface in passenger app.

**Props:**
```javascript
<PassengerMessageThread
  complaint={currentComplaint}        // Full complaint object
  userEmail={userEmail}               // Passenger email
  userName={userName}                 // Passenger name
  onMessageSent={handleMessageSent}   // Callback after send
  apiBase={API_BASE}                  // API base URL
  authToken={authToken}               // Bearer token
/>
```

**Features:**
- Officer messages: Blue bubble on left with shield icon
- Passenger messages: Darker blue bubble on right
- Relative timestamps (Just now, 5m ago, etc.)
- Auto-scroll to newest message
- Input disabled when complaint status is "Closed"
- Optimistic UI updates (message shows before API response)
- Empty state with helpful message

---

## Message Type Mappings

| messageType | visibleToPassenger | Use Case |
|---|---|---|
| `system` | true | Officer accepted complaint |
| `officer-reply` | true | Officer sends follow-up message |
| `passenger-message` | true | Passenger sends reply |
| `internal-note` | false | Officer notes (not visible to passenger) |
| `status-update` | true | Automatic status change notification |

---

## Error Handling

### Common Errors

**400 - Validation Error:**
- Missing complaint ID in URL
- Empty message text
- Invalid request body format

**401 - Authentication Error:**
- Missing x-user-email header
- Invalid or expired token
- Missing Authorization header

**403 - Permission Error:**
- User email doesn't match complaint's passengerEmail
- Attempting to access another passenger's complaint

**404 - Not Found:**
- Complaint ID doesn't exist
- Complaint belongs to different passenger

**500 - Server Error:**
- Database failure
- Socket emission failure
- Unexpected exception in handler

---

## Testing Checklist

### API Testing
- [ ] GET /api/passenger/messages/:id returns filtered messages
- [ ] POST /api/passenger/messages/:id creates ComplaintReply
- [ ] Messages include proper timestamps
- [ ] Officer name/role included in responses
- [ ] isInternalNote flag filters out internal notes
- [ ] visibleToPassenger flag respected in GET

### Socket Testing
- [ ] passenger:message event broadcasts to passengers
- [ ] complaint:new-message event broadcasts to officers
- [ ] Real-time message appears without page refresh
- [ ] Multiple tabs sync messages correctly
- [ ] Disconnection/reconnection handles messages properly

### Frontend Testing
- [ ] PassengerMessageThread renders in complaint detail
- [ ] Officer messages display in blue bubbles
- [ ] Passenger messages display in darker bubbles
- [ ] Send button works for new messages
- [ ] Auto-scroll shows latest message
- [ ] Input disabled when status is "Closed"
- [ ] Timestamps format correctly (Just now, 5m ago, etc.)
- [ ] Empty state shows for new complaints

### End-to-End Testing
- [ ] Officer sends message → appears in passenger app in real-time
- [ ] Passenger sends message → appears in officer dashboard
- [ ] Multiple officers accessing same complaint see messages
- [ ] Messages persist after page reload
- [ ] Message order maintained (oldest to newest)
- [ ] Status updates reflect in message thread

---

## Database Indexes for Performance

```javascript
// Create in MongoDB
db.complaintReplies.createIndex({ complaintId: 1, repliedAt: 1 })
db.complaintReplies.createIndex({ complaintId: 1, visibleToPassenger: 1, repliedAt: 1 })
db.complaints.createIndex({ passengerEmail: 1, _id: 1 })
```

---

## Integration with Existing Features

### Complaint Status Changes
When complaint status changes, new status is included in message as `statusUpdate` field:

```javascript
// Officer escalates to police
ComplaintReply created with:
{
  messageType: "status-update",
  statusUpdate: "Escalated to Police",
  message: "Complaint escalated to police for further action"
}
```

### Timeline Integration
Message timeline maintains complete history:
- Officer actions (accept, investigate, etc.)
- Officer messages
- Passenger messages
- Internal notes (isInternalNote: true, hidden from passenger)

---

## Security Considerations

1. **Passenger Authorization:**
   - All passenger endpoints verify x-user-email matches complaint.passengerEmail
   - Token validated against user claims

2. **Message Visibility:**
   - visibleToPassenger flag prevents internal notes from leaking
   - MessageType distinguishes system/officer/passenger messages

3. **Input Validation:**
   - Message text required and trimmed
   - ComplaintId validated as ObjectId
   - Email format validated

4. **Audit Trail:**
   - All messages timestamped
   - Officer identity tracked via officerId
   - Action logging includes message sends
   - Database timestamps auto-managed by Mongoose

---

## Rate Limiting Recommendations

For production deployment:
- Passenger messages: 20 messages per 5 minutes per user
- Officer messages: 50 messages per 5 minutes per officer
- Message content: Max 1000 characters per message
- Complaint messages: Max 500 total messages per complaint

---

## Future Enhancements

1. **Message Editing/Deletion:**
   - Add `isEdited`, `editedAt` fields
   - Soft-delete with archive flag

2. **Attachments:**
   - Support file/image uploads with S3 integration
   - Scan for malware before storage

3. **Read Receipts:**
   - Track when passenger/officer reads message
   - Visual indicator (read/unread)

4. **Typing Indicators:**
   - Socket event when typing starts/stops
   - "Officer is typing..." status

5. **Message Search:**
   - Full-text search across messages
   - Filter by date range, sender type

6. **Auto-Responses:**
   - System messages for after-hours responses
   - Canned reply templates for officers
