# Priority System - Quick Reference

## What Was Built

A complete complaint priority system that:
- ✅ Automatically assigns priority (Low/Normal/High/Critical)
- ✅ Considers 7 weighted factors (item value, passenger vulnerability, security, etc.)
- ✅ Auto-escalates high-priority complaints if not accepted within 5 minutes
- ✅ Displays priorities prominently in officer dashboard
- ✅ Broadcasts escalation events in real-time
- ✅ Resets escalation timer when accepted

---

## Quick Integration Guide

### For Officer Dashboard
```javascript
import PriorityBadge, { PriorityBadgeList, PriorityHeader } from "./src/components/PriorityBadge";

// In complaint list
<PriorityBadgeList complaint={complaint} />

// In detail view
<PriorityHeader complaint={complaint} />
<PrioritySummary complaint={complaint} />

// Listen for escalations
socket.on("complaint:auto-escalated", (payload) => {
  Alert.alert("Escalated", `${payload.newRole} now notified`);
});
```

### For Passenger Dashboard
```javascript
// Show why complaint is high priority
<PrioritySummary complaint={complaint} />

// Show priority badge
<PriorityBadge priority={complaint.priority} size="small" />
```

---

## Priority Scores (Total points determine level)

```
Critical (60+):    🔴 Child + high-value + night travel
High (40-59):      ⚠️  Valuable item OR vulnerable passenger
Normal (20-39):    🔵 Standard risk items
Low (<20):         ✅ Basic items, adult, daytime
```

## Factor Weights

| Factor | Points | Trigger |
|--------|--------|---------|
| Item Value >₹10k | 40 | Automatic |
| Security Suspicion | 30 | Flagged |
| Theft Indication | 25 | Flagged |
| Child Passenger | 35 | Age <12 |
| Senior Passenger | 25 | Age >60 |
| Woman Passenger | 15 | Gender |
| Night Travel (10PM-5AM) | 20 | Time |
| High-Risk Item | 15 | Electronics/docs |

---

## Auto-Escalation Timeline

```
Complaint Created (High/Critical)
        ↓
Auto-Escalation Timer Starts (5 min)
        ↓
Not Accepted? → AUTO-ESCALATES TO RPF
        ↓
If Still Not Accepted? → ESCALATES TO POLICE
        ↓
If Accepted → TIMER RESETS
```

---

## Key Files Created/Modified

**Created:**
- `server/src/utils/priorityCalculator.js` - Scoring engine
- `server/src/services/autoEscalationService.js` - Escalation logic
- `client/src/components/PriorityBadge.js` - UI components

**Modified:**
- `server/src/models/Complaint.js` - Added priority fields
- `server/src/routes/passenger.js` - Calculate priority on creation
- `server/src/routes/complaints.js` - Sort by priority, add metadata
- `server/src/index.js` - Initialize auto-escalation service

---

## Testing in 5 Minutes

### Test 1: Create Critical Priority
```bash
curl -X POST http://localhost:5000/api/passenger/complaints \
  -H "x-user-email: test@example.com" \
  -H "x-user-age: 10" \
  -d '{
    "itemType": "laptop",
    "itemValue": 150000,
    "description": "Lost on train",
    "vehicleNumber": "12345",
    "route": "Mumbai-Delhi",
    "lastSeenLocation": "Coach A",
    "transportType": "train",
    "securitySuspicion": true
  }'
# Expected: priority = "Critical"
```

### Test 2: Check Officer List Sorted by Priority
```bash
curl http://localhost:5000/api/complaints/officer/OFFICER_ID \
  -H "x-user-email: officer@example.com" \
  -H "x-user-role: TTR/RPF/Police"
# Expected: Critical complaints at top
```

### Test 3: Monitor Auto-Escalation
1. Create critical complaint
2. Wait 5 minutes without accepting
3. Check database: `db.complaints.findOne({autoEscalated: true})`
4. Check logs: `db.actionLogs.find({action: "COMPLAINT_AUTO_ESCALATED"})`

---

## Configuration Adjustments

### Change Check Interval (e.g., 10 seconds for testing)
File: `server/src/index.js`
```javascript
startAutoEscalationService(10000); // Was 30000
```

### Change Escalation Timeout (e.g., 1 minute)
File: `server/src/routes/passenger.js`
```javascript
autoEscalationTimer: {
  timeoutMs: 60000, // Was 300000 (5 min)
  startedAt: new Date(),
}
```

### Change Priority Score Thresholds
File: `server/src/utils/priorityCalculator.js`
```javascript
if (priorityScore >= 50) { // Was 60
  priority = PRIORITY_LEVELS.CRITICAL;
}
```

---

## Visual Indicators

### Priority Badge Colors
- 🟢 Low - Green (#10B981)
- 🔵 Normal - Blue (#3B82F6)
- 🟠 High - Amber (#F59E0B)
- 🔴 Critical - Red (#EF4444) with glow

### Icons
- Low: ✓ checkmark
- Normal: ● circle
- High: ⚠ warning
- Critical: 🔴 alert

---

## Socket Events

### Auto-Escalation Event
```javascript
socket.on("complaint:auto-escalated", {
  complaintId: "CRN-...",
  previousRole: "TTR",
  newRole: "RPF",
  escalationLevel: "STATION_LEVEL",
  reason: "No acceptance within timeout"
})
```

---

## Database Queries

### Find Critical Complaints Not Yet Accepted
```javascript
db.complaints.find({
  priority: "Critical",
  acceptedAt: null
})
```

### Find Auto-Escalated Complaints
```javascript
db.complaints.find({
  autoEscalated: true
}).sort({ autoEscalatedAt: -1 })
```

### Check Escalation History
```javascript
db.complaints.findOne({ _id: ObjectId("...") }, {
  _id: 1,
  priority: 1,
  autoEscalated: 1,
  autoEscalationTimer: 1,
  escalationLevel: 1,
  messages: 1
})
```

---

## Troubleshooting

### Complaints Not Sorting by Priority
**Check:** `sortByPriority()` function in priorityCalculator.js
**Fix:** Verify priority enum values are exactly: "Low", "Normal", "High", "Critical"

### Auto-Escalation Not Triggering
**Check:** Is service started? Look for "🚀 Starting auto-escalation service" in logs
**Check:** Is complaint High/Critical priority?
**Check:** Is complaint NOT accepted? (`acceptedAt` must be null)
**Fix:** Restart server: `npm start`

### Wrong Priority Calculated
**Check:** Priority factors in `priorityFactors` object
**Review:** Score calculation in `calculatePriority()` function
**Debug:** Log the factors: `console.log(priorityFactors)`

---

## Next Steps

1. **Test Priority System** - Follow testing checklist
2. **Customize Thresholds** - Adjust scores to match your needs
3. **Integrate UI** - Add components to officer/passenger dashboards
4. **Monitor Metrics** - Track priority distribution and escalation rates
5. **Gather Feedback** - Adjust factors based on real-world usage

---

## Support Resources

- **Full Documentation:** See `PRIORITY_SYSTEM_DOCUMENTATION.md`
- **API Reference:** See `server/src/utils/priorityCalculator.js`
- **UI Components:** See `client/src/components/PriorityBadge.js`
- **Escalation Logic:** See `server/src/services/autoEscalationService.js`

---

**Status:** ✅ Complete and ready for testing
**Last Updated:** May 4, 2026
