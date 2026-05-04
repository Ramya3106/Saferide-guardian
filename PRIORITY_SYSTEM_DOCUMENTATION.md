# PRIORITY SYSTEM IMPLEMENTATION

## Overview

A comprehensive complaint priority system that automatically determines priority levels based on multiple factors and implements auto-escalation for high-priority complaints.

## Features

### 1. Priority Levels
- **Low** - Minor items, low value, no risk factors
- **Normal** - Standard complaints with basic risk
- **High** - Valuable items, vulnerable passengers, or suspicious activity
- **Critical** - Child/senior travelers, high-value items, security threats, or theft indication

### 2. Priority Determination Factors (Weighted)

| Factor | Score Range | Conditions |
|--------|-------------|-----------|
| **Item Value** | 0-40 pts | VeryHigh (>₹10k) = 40pts, High (₹2k-10k) = 25pts, Medium (₹500-2k) = 15pts, Low (<₹500) = 5pts |
| **Security Suspicion** | 0-30 pts | Suspicious activity flagged = 30pts |
| **Theft Indication** | 0-25 pts | Suspected theft = 25pts |
| **Passenger Vulnerability** | 0-35 pts | Child (<12yr) = 35pts, Senior (>60yr) = 25pts, Woman = 15pts, PWD = 20pts |
| **Night Travel** | 0-20 pts | Travel between 10 PM - 5 AM = 20pts |
| **Item Risk** | 0-15 pts | Electronics, documents, valuables = 15pts |
| **Official Channel** | 0-5 pts | Police/RPF report = 5pts |

**Total Score → Priority:**
- 60+ = Critical
- 40-59 = High
- 20-39 = Normal
- <20 = Low

---

## Database Schema Updates

### Complaint Model Additions

```javascript
{
  priority: String,                          // "Low" | "Normal" | "High" | "Critical"
  priorityFactors: {
    itemValue: String,                       // "Low" | "Medium" | "High" | "VeryHigh"
    itemValueAmount: Number,                 // ₹ value
    securitySuspicion: Boolean,              // Suspicious activity
    passengerVulnerability: String,          // "Adult" | "Child" | "Senior" | "Woman" | "PWD"
    nightTravel: Boolean,                    // Travel in risky hours (10PM-5AM)
    theftIndication: Boolean,                // Suspected theft
    createdAt: Date                          // When factors calculated
  },
  priorityCalculatedAt: Date,                // Timestamp of calculation
  autoEscalated: Boolean,                    // Has been auto-escalated
  autoEscalatedAt: Date,                     // When escalated
  autoEscalationTimer: {
    timeoutMs: Number,                       // Default 300000ms (5 min demo)
    startedAt: Date,                         // Escalation window start
    escalatedAt: Date                        // When escalated
  }
}
```

---

## API Endpoints

### POST /api/passenger/complaints
Complaint creation now includes:
- Automatic priority calculation
- Priority factors determination
- Auto-escalation timer initialization (for High/Critical)

**Request includes:**
```javascript
{
  itemValue: 15000,              // Estimated value
  itemType: "laptop",
  securitySuspicion: true,       // Optional flag
  theftIndication: false,        // Optional flag
  passengerAge: 8,               // Auto flags as "Child"
  passengerGender: "female",     // Auto increases priority
  passengerDisability: false,
  // ... standard complaint fields
}
```

**Response includes:**
```javascript
{
  complaint: {
    priority: "Critical",
    priorityFactors: {
      itemValue: "VeryHigh",
      itemValueAmount: 15000,
      passengerVulnerability: "Child",
      // ... other factors
    },
    alertPriorityReason: "Child traveling alone with high-value item at night",
    autoEscalationTimer: {
      timeoutMs: 300000,
      startedAt: "2026-05-04T10:30:00Z"
    }
  }
}
```

### GET /api/complaints/officer/:officerId
Officer complaints now:
- **Sorted by priority** (Critical → High → Normal → Low)
- **Sorted by date** (newest first within same priority)
- **Include metadata:**
  - `priorityColor` - UI display color
  - `priorityLabel` - Readable label
  - `priorityReason` - Why this priority

**Response:**
```javascript
{
  complaints: [
    {
      _id: "...",
      priority: "Critical",
      priorityColor: "#EF4444",
      priorityLabel: "CRITICAL PRIORITY",
      priorityReason: "Child passenger, high-value item, night travel",
      autoEscalated: false,
      acceptedAt: null,
      // ... other fields sorted by priority
    },
    // ... more complaints sorted by priority
  ],
  total: 25
}
```

### PATCH /api/complaints/:id/staff/accept
When officer accepts complaint:
- Auto-escalation timer is **reset** (prevents further escalation)
- Can accept multiple times without re-escalation

---

## Auto-Escalation Service

### Functionality

**File:** `server/src/services/autoEscalationService.js`

Runs every 30 seconds (configurable) to check:
1. Find all High/Critical priority complaints
2. Check if NOT accepted
3. Check if escalation timeout exceeded
4. If timeout exceeded → escalate to next authority level

**Escalation Flow:**
```
TRAIN LEVEL (TTR/TTE)
        ↓ (if not accepted in 5 min)
STATION LEVEL (RPF)
        ↓ (if not accepted in 5 min)
POLICE LEVEL (Police)
```

### Events Emitted

**complaint:auto-escalated** - Broadcast to all listening officers
```javascript
{
  complaintId: "507f...",
  complaint: { /* full complaint */ },
  previousRole: "TTR",
  newRole: "RPF",
  escalationLevel: "STATION_LEVEL",
  reason: "No acceptance within timeout period",
  notifiedOfficers: [ /* list of newly notified officers */ ]
}
```

### Configuration

**Current Demo Settings:**
- Check interval: 30 seconds
- Timeout: 5 minutes (300,000 ms) per escalation level
- Triggers on: High and Critical priorities only
- Escalates to: RPF → Police → Supervisor

**To customize:**
Edit in `server/src/index.js`:
```javascript
// Start auto-escalation service (check every X seconds)
startAutoEscalationService(30000); // Change to desired interval
```

Change timeout in `server/src/routes/passenger.js`:
```javascript
autoEscalationTimer: {
  timeoutMs: 300000, // Change 300000 to desired milliseconds
  startedAt: new Date(),
}
```

---

## Frontend Components

### PriorityBadge Component

**File:** `client/src/components/PriorityBadge.js`

#### Basic Badge
```javascript
import PriorityBadge from "./PriorityBadge";

<PriorityBadge 
  priority="Critical"
  size="medium"
  showLabel={true}
/>
```

**Props:**
- `priority` - "Low", "Normal", "High", "Critical"
- `size` - "small", "medium", "large"
- `showLabel` - Boolean, show text label
- `style` - Additional styling

**Colors:**
- Low: Green (#10B981)
- Normal: Blue (#3B82F6)
- High: Amber (#F59E0B)
- Critical: Red (#EF4444) with glow effect

#### Priority Badge List
```javascript
import { PriorityBadgeList } from "./PriorityBadge";

<PriorityBadgeList complaint={complaint} />
```

Shows:
- Priority badge
- "ESCALATED" badge if auto-escalated
- "PENDING" timer if high-priority and not accepted

#### Priority Summary
```javascript
import { PrioritySummary } from "./PriorityBadge";

<PrioritySummary complaint={complaint} />
```

Displays:
- List of contributing factors with emoji
- "Standard assessment" if no special factors

#### Priority Header
```javascript
import { PriorityHeader } from "./PriorityBadge";

<PriorityHeader complaint={complaint} />
```

Large header for detail view with:
- Large icon and priority level
- Contributing factors summary
- Escalation status if auto-escalated

---

## Integration Points

### Officer Dashboard
1. **Import component:**
   ```javascript
   import PriorityBadge, { PriorityBadgeList, PriorityHeader } from "./src/components/PriorityBadge";
   ```

2. **In complaint list item:**
   ```javascript
   <PriorityBadgeList complaint={complaint} style={{ marginBottom: 8 }} />
   ```

3. **In complaint detail view:**
   ```javascript
   <PriorityHeader complaint={complaint} />
   <PrioritySummary complaint={complaint} />
   ```

4. **Listen for auto-escalation events:**
   ```javascript
   socket.on("complaint:auto-escalated", (payload) => {
     // Update complaint with new priority/escalation
     mergeComplaintRecord(payload);
     
     // Show notification
     Alert.alert(
       "Complaint Auto-Escalated",
       `${payload.complaint.complaintId} escalated to ${payload.newRole}`
     );
   });
   ```

### Passenger Dashboard
Show priority information for transparency:
```javascript
<PriorityBadge priority={complaint.priority} size="small" />
<PrioritySummary complaint={complaint} />
```

---

## Socket Events

### complaint:auto-escalated
```javascript
socket.on("complaint:auto-escalated", (payload) => {
  const {
    complaintId,
    complaint,
    previousRole,
    newRole,
    escalationLevel,
    reason,
    notifiedOfficers
  } = payload;
  
  // Handle escalation in UI
});
```

---

## Testing Priority System

### Manual Testing Checklist

- [ ] Create low-priority complaint (standard item, adult passenger)
  - Expected: "Low" priority, no escalation timer
  
- [ ] Create normal-priority complaint
  - Expected: "Normal" priority, no auto-escalation
  
- [ ] Create high-priority complaint (valuable item, female passenger)
  - Expected: "High" priority, 5-minute auto-escalation timer
  
- [ ] Create critical-priority complaint (child + laptop + night travel)
  - Expected: "Critical" priority with 4+ factors
  
- [ ] Accept high-priority within 5 minutes
  - Expected: Escalation timer reset, no auto-escalation
  
- [ ] Let high-priority timeout without accepting
  - Expected: Auto-escalation fires, officers notified, complaint escalated to RPF
  
- [ ] View officer dashboard
  - Expected: Critical/High priority complaints at top
  
- [ ] View escalated complaint detail
  - Expected: "ESCALATED" badge visible, escalation timeline visible

### Database Testing

```javascript
// Check priority calculation
db.complaints.findOne({ priority: "Critical" })

// Find auto-escalated complaints
db.complaints.find({ autoEscalated: true })

// Check escalation status
db.complaints.findOne({
  "autoEscalationTimer.escalatedAt": { $exists: true }
})

// Verify priority factors
db.complaints.findOne({ _id: ObjectId("...") })
  .priorityFactors
```

### API Testing

```bash
# Create critical priority complaint
curl -X POST http://localhost:5000/api/passenger/complaints \
  -H "Content-Type: application/json" \
  -H "x-user-email: passenger@example.com" \
  -H "x-user-name: Test Passenger" \
  -H "x-user-age: 10" \
  -d '{
    "itemType": "laptop",
    "itemValue": 150000,
    "description": "Lost during night train",
    "transportType": "train",
    "vehicleNumber": "12345",
    "route": "Mumbai-Delhi",
    "lastSeenLocation": "Coach A",
    "securitySuspicion": true
  }'

# Expected response priority: "Critical"
```

---

## Configuration Reference

### Environment Variables
```bash
# Optional: Configure auto-escalation interval
AUTO_ESCALATION_CHECK_INTERVAL_MS=30000  # Default 30 seconds

# Optional: Configure escalation timeout per level
AUTO_ESCALATION_TIMEOUT_MS=300000        # Default 5 minutes
```

### Adjusting Priority Scores

Edit `server/src/utils/priorityCalculator.js`:

```javascript
// Example: Increase high-value item impact
if (itemValue <= 2000) {
  priorityScore += 15;  // Change this value
}
```

---

## Limitations & Future Enhancements

### Current Limitations
- Fixed 5-minute escalation timeout
- 3-level escalation (Train → Station → Police)
- No manual priority override by officers
- No priority suppression/suspension

### Planned Enhancements
1. **Manual Priority Override** - Officer can increase/decrease priority
2. **Configurable Escalation** - Admin panel to adjust timeouts and levels
3. **SLA Tracking** - Track response time against priority SLAs
4. **Priority History** - Track all priority changes with reasoning
5. **Smart Routing** - Route based on priority expertise needed
6. **ML-Based Scoring** - Machine learning to improve priority prediction
7. **Bulk Actions** - Mark multiple high-priority as reviewed
8. **Priority Alerts** - Push notifications for critical escalations

---

## Monitoring & Analytics

### Key Metrics to Track

1. **Priority Distribution** - % of Low/Normal/High/Critical
2. **Escalation Rate** - % of complaints that auto-escalate
3. **Acceptance Time** - Time to accept by priority level
4. **Resolution Time** - Time to resolve by priority level
5. **False Positive Rate** - How often priority is wrong

### Logging
All priority-related actions logged:
- `COMPLAINT_CREATED_AND_ROUTED` - Initial priority assignment
- `COMPLAINT_AUTO_ESCALATED` - Escalation events
- `OFFICER_ACCEPTED_COMPLAINT` - Resets escalation timer

View logs:
```javascript
db.actionLogs.find({ 
  action: /PRIORITY|ESCALAT/ 
}).sort({ createdAt: -1 })
```

---

## Summary

✅ **Complete Priority System Implemented:**
- Automatic priority calculation based on 7 weighted factors
- Database schema with priority tracking fields
- Auto-escalation service (check every 30 sec, timeout 5 min)
- Officer complaint list sorted by priority
- Frontend components for priority display
- Socket events for real-time escalation notifications
- Testing checklist and documentation
- Ready for production deployment

**Key Files:**
- `server/src/utils/priorityCalculator.js` - Priority calculation engine
- `server/src/services/autoEscalationService.js` - Auto-escalation logic
- `client/src/components/PriorityBadge.js` - UI components
- `server/src/routes/passenger.js` - Complaint creation with priority
- `server/src/routes/complaints.js` - Officer list sorted by priority
- `server/src/index.js` - Service initialization
