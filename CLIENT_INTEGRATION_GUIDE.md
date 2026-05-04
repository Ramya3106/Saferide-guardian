# Officer Actions - Client Integration Guide

## Overview

This guide explains how to integrate officer actions into the client application with real-time updates and timeline synchronization.

## Components

### 1. ComplaintDetailView.js

The main component for displaying complaint details and officer actions.

**Props:**
- `complaint`: Complaint object (with all fields including messages, status, etc.)
- `onOpenReply`: Callback when Reply button is pressed
- `onActionComplete`: Callback when an action completes

**Features:**
- Displays 9 officer action buttons
- Shows activity timeline with all actions/messages
- Modal dialogs for actions requiring additional input
- Real-time timeline updates

**Usage:**
```jsx
import ComplaintDetailView from './screens/officer/ComplaintDetailView';

<ComplaintDetailView
  complaint={selectedComplaint}
  onOpenReply={() => setShowReplyModal(true)}
  onActionComplete={(data) => {
    // Update complaint with new data
    setSelectedComplaint(data.complaint);
  }}
/>
```

### 2. socketClient.js

Utility module for real-time socket connections.

**Key Functions:**

```javascript
import {
  initSocket,
  getSocket,
  joinComplaintRoom,
  leaveComplaintRoom,
  onComplaintStatusChange,
  onComplaintAccepted,
  onComplaintReply,
  onComplaintEscalation,
  onComplaintResolved,
  onComplaintClosed,
  onComplaintReassigned,
  onNoteAdded,
  disconnectSocket,
} from '../utils/socketClient';

// Initialize socket connection
useEffect(() => {
  initSocket('http://localhost:5000');
  return () => disconnectSocket();
}, []);

// Join complaint room for real-time updates
useEffect(() => {
  if (selectedComplaint) {
    joinComplaintRoom(selectedComplaint._id);
  }
}, [selectedComplaint]);

// Listen for status changes
useEffect(() => {
  onComplaintStatusChange((data) => {
    console.log('Complaint updated:', data);
    setSelectedComplaint(data.complaint);
  });
}, []);
```

### 3. OfficerDashboardScreen Integration

The dashboard already has socket integration but needs to be updated to use the new socket utilities.

**Current Implementation:**
- Uses `io()` from socket.io-client
- Listens for complaint updates
- Merges incoming data with local state

**Integration Steps:**

```javascript
import {
  initSocket,
  joinComplaintRoom,
  onComplaintStatusChange,
  // ... other imports
} from '../../utils/socketClient';

useEffect(() => {
  // Initialize socket
  const socket = initSocket(SOCKET_BASE);
  
  // Listen for events
  onComplaintStatusChange((data) => {
    mergeAlert(data);
  });
  
  return () => {
    // Cleanup handled by socketClient
  };
}, []);
```

---

## Action Flow

### 1. Accept Complaint

```javascript
// Request
PATCH /api/complaints/{id}/staff/accept
Headers: [x-user-email, x-user-role, x-user-name, x-duty-unit]
Body: {}

// Response
{
  complaint: { ...updated complaint with status: "Accepted" },
  reply: { ...complaint reply record }
}

// Socket Event: complaint:accepted
{
  complaintId: "...",
  complaint: { ...full object },
  acceptedAt: timestamp,
  actorRole: "TTR"
}

// UI Update
- Status changes to "Accepted"
- Timeline shows "Complaint accepted"
- Accept button becomes disabled
```

### 2. Start Investigation

```javascript
// Request
PATCH /api/complaints/{id}/staff/start-investigation
Headers: [x-user-email, x-user-role, x-user-name, x-duty-unit]
Body: {}

// Response
{
  complaint: { ...updated complaint with status: "Item Being Checked" },
  reply: { ...complaint reply record }
}

// Socket Event: complaint:status-change
{
  complaintId: "...",
  previousStatus: "Accepted",
  newStatus: "Item Being Checked",
  actorRole: "TTR"
}

// UI Update
- Status changes to "Item Being Checked"
- Timeline shows "Investigation started"
```

### 3. Reply to Passenger

```javascript
// Existing endpoint (already implemented)
POST /api/complaints/{id}/staff/respond
Body: {
  text: "Message to passenger",
  markPassengerContacted: false,
  staffEta: "10 mins"
}

// Socket Event: complaint:reply
{
  complaintId: "...",
  complaint: { ...full object },
  reply: { ...reply object },
  actorRole: "TTR"
}

// UI Update
- Timeline shows officer message
- Status may change to "Staff Notified" or "Passenger Contacted"
```

### 4. Add Internal Note

```javascript
// Request
POST /api/complaints/{id}/staff/note
Body: {
  note: "Internal observation text"
}

// Socket Event: complaint:note-added
{
  complaintId: "...",
  complaint: { ...full object },
  note: "...",
  actorRole: "TTR"
}

// UI Update
- Timeline shows "[INTERNAL NOTE] text" (internal notes marked differently)
- officerNotes field updated
```

### 5. Escalate to RPF

```javascript
// Request
PATCH /api/complaints/{id}/staff/escalate-rpf
Body: {
  reason: "Reason for escalation"
}

// Socket Event: complaint:escalation
{
  complaintId: "...",
  escalationLevel: "RPF",
  escalatedBy: "Officer Name",
  escalatedAt: timestamp,
  actorRole: "TTR"
}

// UI Update
- escalationLevel set to "RPF"
- assignedRole set to "RPF"
- Timeline shows "Escalated to Railway Police Force (RPF)"
```

### 6. Escalate to Police

```javascript
// Request
PATCH /api/complaints/{id}/staff/escalate-police
Body: {
  reason: "Reason for escalation"
}

// Socket Event: complaint:escalation
{
  complaintId: "...",
  escalationLevel: "Police",
  escalatedBy: "Officer Name",
  escalatedAt: timestamp,
  actorRole: "TTR"
}

// UI Update
- escalationLevel set to "Police"
- assignedRole set to "Police"
- Timeline shows "Escalated to Police"
```

### 7. Reassign

```javascript
// Request
PATCH /api/complaints/{id}/staff/reassign
Body: {
  assignToUnit: "RPF",  // Valid: TTR, TTE, RPF, POLICE
  reason: "Reason for reassignment"
}

// Socket Event: complaint:reassigned
{
  complaintId: "...",
  reassignedFrom: "TTR",
  reassignedTo: "RPF",
  reason: "...",
  reassignedBy: "Officer Name",
  reassignedAt: timestamp
}

// UI Update
- assignedRole changed to new unit
- Timeline shows reassignment details
```

### 8. Resolve

```javascript
// Request
PATCH /api/complaints/{id}/staff/resolve
Body: {
  resolutionDetails: "How the complaint was resolved"
}

// Socket Event: complaint:resolved
{
  complaintId: "...",
  resolutionDetails: "...",
  resolvedBy: "Officer Name",
  resolvedAt: timestamp,
  actorRole: "TTR"
}

// UI Update
- Status changes to "Recovered"
- itemFound set to true
- resolvedAt timestamp recorded
- Timeline shows resolution details
```

### 9. Close

```javascript
// Request
PATCH /api/complaints/{id}/staff/close
Body: {
  closureReason: "Final reason for closure"
}

// Socket Event: complaint:closed
{
  complaintId: "...",
  closureReason: "...",
  closedBy: "Officer Name",
  closedAt: timestamp,
  actorRole: "TTR"
}

// UI Update
- Status changes to "Closed"
- closedAt timestamp recorded
- Timeline shows closure reason
```

---

## Real-Time Update Architecture

### Socket Event Flow

```
Client Action Button
    ↓
POST/PATCH to API Endpoint
    ↓
Server processes & saves
    ↓
Server emits socket event
    ↓
Socket.io broadcasts to room:
    - complaint:{complaintId}
    - officer:{officerId}
    - passenger:{passengerId}
    ↓
All connected clients receive update
    ↓
Local state updated
    ↓
UI re-renders with new timeline
```

### Room Subscriptions

```javascript
// Officer joins their assigned complaints
socket.emit('join', `complaint:${complaintId}`);

// Officer joins their personal room
socket.emit('join', `officer:${officerId}`);

// Passenger joins complaint room
socket.emit('join', `passenger:${passengerId}`);
```

### Timeline Update

Timeline is stored in `complaint.messages` array:

```javascript
// Each entry
{
  staffId: "officer-id",
  staffName: "Officer Name",
  text: "What happened",
  timestamp: Date,
  isInternalNote: boolean  // true for internal notes only
}

// Display logic
- Sort by timestamp (newest first)
- Show staffName and text
- Show formatted timestamp
- Style internal notes differently (not visible to passenger)
- Real-time sync via socket events
```

---

## Implementation Checklist

- [ ] Install socket.io-client: `npm install socket.io-client`
- [ ] Create socketClient.js utility
- [ ] Update ComplaintDetailView with action buttons
- [ ] Implement action modals with input fields
- [ ] Add timeline display section
- [ ] Integrate socket listeners in OfficerDashboardScreen
- [ ] Test each action endpoint
- [ ] Verify real-time updates work
- [ ] Test offline behavior (queue and retry)
- [ ] Add error handling and user feedback
- [ ] Test with multiple connected clients

---

## Testing

### Manual Testing Flow

1. **Open complaint detail view**
   - Verify all 9 action buttons display

2. **Click each action**
   - Accept: Status should change to "Accepted"
   - Investigate: Status should change to "Item Being Checked"
   - Reply: Should show modal, send message on confirm
   - Note: Should show modal, add internal note
   - Escalate RPF: Should set escalationLevel to "RPF"
   - Escalate Police: Should set escalationLevel to "Police"
   - Reassign: Should show modal, change assignedRole
   - Resolve: Should show modal, change status to "Recovered"
   - Close: Should show modal, change status to "Closed"

3. **Verify timeline**
   - Each action should appear in timeline
   - Newest entries first
   - Internal notes marked as internal
   - Timestamps formatted correctly

4. **Test real-time updates**
   - Open same complaint in 2 browser tabs
   - Perform action in tab 1
   - Verify tab 2 updates automatically
   - Verify timeline syncs across both

5. **Test error handling**
   - Try action without required input
   - Try action with invalid officer credentials
   - Verify error messages display

---

## Troubleshooting

### Socket not connecting
- Check SOCKET_BASE URL matches server
- Verify server socket.io is initialized
- Check browser console for connection errors
- Verify CORS settings on server

### Updates not appearing in timeline
- Check socket events are being emitted
- Verify room subscriptions are correct
- Check browser console for errors
- Verify complaint.messages array updates

### Actions not working
- Check authentication headers are correct
- Verify officer is on duty
- Check request payload matches API spec
- Verify complaint exists and is assigned to officer

### Performance issues
- Limit timeline to latest 50 entries
- Debounce socket event handlers
- Use React.memo for timeline items
- Lazy load timeline if very long
