# Officer Actions - Quick Start Guide

## Setup & Testing

### Prerequisites
- Node.js & npm installed
- MongoDB running locally or connected
- Server and client already set up

### Installation

#### 1. Install Socket.IO Client

```bash
cd client
npm install socket.io-client
```

#### 2. Update Environment

Ensure your environment is configured:

```bash
# In client/.env or config
API_BASE=http://localhost:5000/api
SOCKET_BASE=http://localhost:5000
```

#### 3. Verify Server Socket.io Setup

Check that `server/src/index.js` has socket.io initialized:

```javascript
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');

const httpServer = http.createServer(app);
const io = socketIo(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
});

// Initialize socket module
const { setIo } = require('./utils/socket');
setIo(io);

httpServer.listen(5000, () => {
  console.log('Server running on port 5000');
});
```

### Running the Application

#### Terminal 1 - Start Backend

```bash
cd server
npm start
```

Expected output:
```
Server running on port 5000
```

#### Terminal 2 - Start Frontend

```bash
cd client
npm start
```

or for Expo:

```bash
npm run android
# or
npm run ios
```

---

## Testing Officer Actions

### Test Case 1: Accept Complaint

**Steps:**
1. Open OfficerDashboardScreen
2. Select a complaint from the alert list
3. Click "Accept" button in ComplaintDetailView
4. Verify modal closes and timeline updates

**Expected Results:**
- ✅ Status changes to "Accepted"
- ✅ Timeline shows "Complaint accepted"
- ✅ acceptedAt timestamp recorded
- ✅ Socket event received on other clients

**API Call:**
```
PATCH http://localhost:5000/api/complaints/{id}/staff/accept
```

### Test Case 2: Start Investigation

**Steps:**
1. First accept a complaint (as above)
2. Click "Investigate" button
3. Verify modal closes and timeline updates

**Expected Results:**
- ✅ Status changes to "Item Being Checked"
- ✅ Timeline shows "Investigation started"
- ✅ investigationStartedAt timestamp recorded

**API Call:**
```
PATCH http://localhost:5000/api/complaints/{id}/staff/start-investigation
```

### Test Case 3: Add Internal Note

**Steps:**
1. Click "Note" button
2. Enter internal note text (e.g., "Checked lost and found, item not there yet")
3. Click "Confirm"
4. Verify timeline updates with internal note

**Expected Results:**
- ✅ Modal closes
- ✅ Timeline shows "[INTERNAL NOTE] text"
- ✅ Internal note marked as `isInternalNote: true`
- ✅ officerNotes field updated

**API Call:**
```
POST http://localhost:5000/api/complaints/{id}/staff/note
Body: { "note": "Your text here" }
```

### Test Case 4: Reply to Passenger

**Steps:**
1. Click "Reply" button
2. Enter message to passenger (e.g., "Your item is being traced")
3. Click "Send"
4. Verify timeline updates with reply

**Expected Results:**
- ✅ Modal closes
- ✅ Timeline shows officer message
- ✅ Message stored in ComplaintReply collection
- ✅ Passenger notified

### Test Case 5: Escalate to RPF

**Steps:**
1. Click "Escalate" button (first escalation button)
2. Enter reason (optional, e.g., "Suspicious activity detected")
3. Click "Confirm"
4. Verify timeline and escalation fields update

**Expected Results:**
- ✅ escalationLevel set to "RPF"
- ✅ assignedRole set to "RPF"
- ✅ Timeline shows escalation
- ✅ Socket event with escalation level

**API Call:**
```
PATCH http://localhost:5000/api/complaints/{id}/staff/escalate-rpf
Body: { "reason": "Your reason here" }
```

### Test Case 6: Escalate to Police

**Steps:**
1. Click "Police" button (second escalation button)
2. Enter reason (e.g., "Serious theft case")
3. Click "Confirm"
4. Verify escalation to Police

**Expected Results:**
- ✅ escalationLevel set to "Police"
- ✅ assignedRole set to "Police"
- ✅ Timeline shows "Escalated to Police"

### Test Case 7: Reassign

**Steps:**
1. Click "Reassign" button
2. Enter reason for reassignment
3. Click "Confirm"
4. Verify reassignment in timeline

**Expected Results:**
- ✅ assignedRole changed
- ✅ Timeline shows "Reassigned from X to Y"
- ✅ staffResponseStatus updated

### Test Case 8: Resolve

**Steps:**
1. Click "Resolve" button
2. Enter resolution details (e.g., "Item found in lost & found, handed to passenger")
3. Click "Confirm"
4. Verify resolution

**Expected Results:**
- ✅ Status changes to "Recovered"
- ✅ itemFound set to true
- ✅ resolvedAt timestamp recorded
- ✅ Timeline shows resolution details

**API Call:**
```
PATCH http://localhost:5000/api/complaints/{id}/staff/resolve
Body: { "resolutionDetails": "Details here" }
```

### Test Case 9: Close

**Steps:**
1. Click "Close" button
2. Enter closure reason (e.g., "Case closed successfully")
3. Click "Confirm"
4. Verify closure

**Expected Results:**
- ✅ Status changes to "Closed"
- ✅ closedAt timestamp recorded
- ✅ Timeline shows closure reason
- ✅ Complaint marked as resolved/closed

---

## Real-Time Sync Testing

### Test Real-Time Updates Across Clients

**Setup:**
1. Open complaint detail view in Browser Tab A
2. Open same complaint in Browser Tab B
3. Tab A and Tab B should have socket connections

**Test Steps:**
1. Click action button in Tab A
2. Verify Tab B updates automatically within 1-2 seconds
3. Verify timeline shows new entry in both tabs

**Expected Results:**
- ✅ Changes appear in real-time
- ✅ No manual refresh needed
- ✅ Timeline synchronized
- ✅ Status synchronized
- ✅ Timeline entries match exactly

---

## Timeline Testing

### Verify Timeline Display

**Expected Behavior:**
1. Each action creates a timeline entry
2. Entries sorted by timestamp (newest first)
3. Staff name and action description visible
4. Timestamps formatted as: "5/4/2026, 10:30:00 AM"
5. Internal notes prefixed with "[INTERNAL NOTE]"

**Test:**
1. Perform 5 different actions
2. Verify timeline shows all 5 entries
3. Verify newest is at top
4. Verify internal notes are styled differently

---

## Error Testing

### Test Invalid Scenarios

**Test 1: Officer Not Assigned**
- Create complaint
- Assign to different officer
- Try to perform action as first officer
- ✅ Should get 403 Forbidden error

**Test 2: Officer Not On Duty**
- Check out from duty
- Try to perform action
- ✅ Should get 403 OFFICER_OFF_DUTY error

**Test 3: Missing Required Fields**
- Click action requiring input (e.g., Note)
- Leave field empty
- Click Confirm
- ✅ Should show validation error

**Test 4: Invalid Reassign Unit**
- Try to reassign to invalid unit
- ✅ Should get 400 validation error

---

## Database Verification

### Check MongoDB Records

**After performing actions, verify:**

#### 1. Complaint Document
```javascript
// In MongoDB
db.complaints.findOne({_id: ObjectId("...")})

// Should show:
{
  status: "Closed",
  messages: [
    {
      staffId: "...",
      staffName: "Officer Name",
      text: "...",
      timestamp: ISODate("...")
    },
    // ... more entries
  ],
  acceptedAt: ISODate("..."),
  investigationStartedAt: ISODate("..."),
  resolvedAt: ISODate("..."),
  closedAt: ISODate("..."),
  escalationLevel: "RPF|Police|null",
  officerNotes: "..."
}
```

#### 2. ComplaintReply Records
```javascript
db.complaintreplies.find({complaintId: ObjectId("...")})

// Should show one entry per action
```

#### 3. ActionLog Records
```javascript
db.actionlogs.find({complaintId: "..."})

// Should show:
{
  action: "OFFICER_ACCEPTED_COMPLAINT",
  actorType: "OFFICER",
  actorId: "officer@example.com",
  actorRole: "TTR",
  entityType: "Complaint",
  entityId: ObjectId("..."),
  metadata: {...}
}
```

---

## Performance Testing

### Load Testing
1. Create 100 test complaints
2. Perform actions on 10 simultaneously
3. Monitor:
   - API response time (<500ms expected)
   - Socket message delivery (<100ms expected)
   - Database write time (<200ms expected)

### Real-Time Sync Testing
1. Open 5 browser tabs with same complaint
2. Perform action in tab 1
3. All 5 tabs should update within 1 second
4. No data loss or conflicts

---

## Troubleshooting

### Socket Not Connecting

**Problem:** Console shows connection errors

**Solution:**
```javascript
// Check SOCKET_BASE is correct
console.log('SOCKET_BASE:', SOCKET_BASE);

// Should output: http://localhost:5000

// Verify server socket.io is running
// Check server console for socket connection message
```

### Timeline Not Updating

**Problem:** New entries don't appear in timeline

**Solution:**
1. Check browser console for errors
2. Verify socket is connected (green indicator)
3. Verify complaint has messages array
4. Check MongoDB for timeline entries

```javascript
// In browser console:
io().on('complaint:status-change', (data) => {
  console.log('Received update:', data);
});
```

### Actions Not Working

**Problem:** API returns 403 or 500 error

**Solution:**
1. Verify authentication headers are correct
2. Check officer is on duty
3. Check complaint is assigned to officer
4. Check MongoDB user document

```javascript
// Verify officer setup
db.users.findOne({email: "officer@example.com"})
// Should show: onDutyStatus: true
```

---

## Useful Commands

### Restart Server
```bash
# Ctrl+C to stop
# Then restart with:
npm start
```

### Clear Database (⚠️ Be Careful!)
```javascript
// In MongoDB shell
db.dropDatabase()
```

### Monitor Server Logs
```bash
npm start 2>&1 | tee server.log
```

### Test API with cURL

```bash
# Accept complaint
curl -X PATCH http://localhost:5000/api/complaints/COMPLAINT_ID/staff/accept \
  -H "x-user-email: officer@example.com" \
  -H "x-user-role: TTR/RPF/Police" \
  -H "x-user-name: Officer Name" \
  -H "x-duty-unit: TTR" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Success Criteria

✅ All tests pass when:
1. Each of 9 actions works correctly
2. Timeline updates in real-time
3. Socket events broadcast to all clients
4. No errors in console
5. MongoDB records created
6. ActionLog entries recorded
7. Multiple clients sync automatically
8. Timestamps are accurate
9. Status transitions are valid
10. Error handling works for invalid scenarios

---

## Next Steps

After successful testing:
1. [ ] Deploy to staging environment
2. [ ] Run full system testing
3. [ ] Get user acceptance testing (UAT)
4. [ ] Deploy to production
5. [ ] Monitor logs for issues
6. [ ] Gather user feedback

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review code comments in implementation
3. Check API documentation
4. Review socket event logs
5. Check MongoDB documents

Enjoy using Officer Actions! 🚀
