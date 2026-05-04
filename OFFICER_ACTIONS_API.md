# Officer Actions API Documentation

## Overview

This document describes all the officer actions available in the complaint management system. Each action updates the complaint timeline in real-time and triggers socket events for live updates.

## Base URL

```
http://localhost:5000/api/complaints/{complaintId}/staff
```

## Authentication Headers

All endpoints require these headers:

```
x-user-email: officer@example.com
x-user-role: TTR/RPF/Police
x-user-name: Officer Name
x-duty-unit: TTR|TTE|RPF|Police
x-professional-id: TTR-12345
```

---

## 1. Accept Complaint

**Endpoint:** `PATCH /:id/staff/accept`

**Description:** Officer accepts responsibility for the complaint.

**Request:**
```json
{}
```

**Response:**
```json
{
  "status": 200,
  "message": "Complaint accepted successfully",
  "data": {
    "complaint": { /* updated complaint object */ },
    "reply": { /* complaint reply record */ }
  }
}
```

**Status Transition:** Any → `Accepted`

**Timeline Entry:** "Complaint accepted"

**Socket Events:**
- `complaint:accepted`
- `complaint:status-change`

---

## 2. Start Investigation

**Endpoint:** `PATCH /:id/staff/start-investigation`

**Description:** Officer starts investigating the complaint (marks as "Item Being Checked").

**Request:**
```json
{}
```

**Response:**
```json
{
  "status": 200,
  "message": "Investigation started successfully",
  "data": {
    "complaint": { /* updated complaint object */ },
    "reply": { /* complaint reply record */ }
  }
}
```

**Status Transition:** Any → `Item Being Checked`

**Timeline Entry:** "Investigation started"

**Socket Events:**
- `complaint:status-change`

**Fields Updated:**
- `investigationStartedAt`: Current timestamp
- `status`: "Item Being Checked"

---

## 3. Reply to Passenger

**Endpoint:** `POST /:id/staff/respond`

**Description:** Officer sends a reply message to the passenger.

**Request:**
```json
{
  "text": "Your item has been found and is being processed for handover.",
  "markPassengerContacted": false,
  "staffEta": "10 mins"
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Reply saved successfully",
  "data": {
    "complaint": { /* updated complaint object */ },
    "reply": { /* complaint reply record */ }
  }
}
```

**Timeline Entry:** Message text from officer

**Socket Events:**
- `complaint:reply`
- `complaint:status-change`

---

## 4. Add Internal Note

**Endpoint:** `POST /:id/staff/note`

**Description:** Officer adds an internal note (not visible to passenger).

**Request:**
```json
{
  "note": "Checked lost & found department. Item not found yet. Will check again tomorrow."
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Internal note added successfully",
  "data": {
    "complaint": { /* updated complaint object */ }
  }
}
```

**Timeline Entry:** "[INTERNAL NOTE] {note text}"

**Socket Events:**
- `complaint:note-added`

**Fields Updated:**
- `messages`: Adds entry with `isInternalNote: true`
- `officerNotes`: Appends note with timestamp

---

## 5. Escalate to RPF

**Endpoint:** `PATCH /:id/staff/escalate-rpf`

**Description:** Officer escalates complaint to Railway Police Force.

**Request:**
```json
{
  "reason": "Suspicious activity detected. Requires police investigation."
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Complaint escalated to RPF successfully",
  "data": {
    "complaint": { /* updated complaint object */ },
    "reply": { /* complaint reply record */ }
  }
}
```

**Status:** `Item Being Checked`

**Timeline Entry:** "Escalated to Railway Police Force (RPF)"

**Socket Events:**
- `complaint:escalation`
- `complaint:status-change`

**Fields Updated:**
- `escalationLevel`: "RPF"
- `assignedRole`: "RPF"

---

## 6. Escalate to Police

**Endpoint:** `PATCH /:id/staff/escalate-police`

**Description:** Officer escalates complaint to local Police.

**Request:**
```json
{
  "reason": "Serious theft incident requires police FIR."
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Complaint escalated to Police successfully",
  "data": {
    "complaint": { /* updated complaint object */ },
    "reply": { /* complaint reply record */ }
  }
}
```

**Status:** `Item Being Checked`

**Timeline Entry:** "Escalated to Police"

**Socket Events:**
- `complaint:escalation`
- `complaint:status-change`

**Fields Updated:**
- `escalationLevel`: "Police"
- `assignedRole`: "Police"

---

## 7. Reassign

**Endpoint:** `PATCH /:id/staff/reassign`

**Description:** Officer reassigns complaint to another unit.

**Request:**
```json
{
  "assignToUnit": "RPF",
  "reason": "Requires RPF expertise for investigation"
}
```

**Valid Units:** `TTR`, `TTE`, `RPF`, `POLICE`

**Response:**
```json
{
  "status": 200,
  "message": "Complaint reassigned successfully",
  "data": {
    "complaint": { /* updated complaint object */ }
  }
}
```

**Timeline Entry:** "Reassigned from {currentUnit} to {newUnit}. Reason: {reason}"

**Socket Events:**
- `complaint:reassigned`

**Fields Updated:**
- `assignedRole`: New unit
- `staffResponseStatus`: "Reassigned to {unit}"

---

## 8. Resolve

**Endpoint:** `PATCH /:id/staff/resolve`

**Description:** Officer marks complaint as resolved (item found/recovered).

**Request:**
```json
{
  "resolutionDetails": "Item found in lost and found. Handed over to passenger at Central Station."
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Complaint resolved successfully",
  "data": {
    "complaint": { /* updated complaint object */ },
    "reply": { /* complaint reply record */ }
  }
}
```

**Status:** `Recovered`

**Timeline Entry:** "Resolved: {resolution details}"

**Socket Events:**
- `complaint:resolved`
- `complaint:status-change`

**Fields Updated:**
- `status`: "Recovered"
- `itemFound`: true
- `resolvedAt`: Current timestamp

---

## 9. Close

**Endpoint:** `PATCH /:id/staff/close`

**Description:** Officer closes the complaint (final closure).

**Request:**
```json
{
  "closureReason": "Item recovered and handed over. Case closed."
}
```

**Response:**
```json
{
  "status": 200,
  "message": "Complaint closed successfully",
  "data": {
    "complaint": { /* updated complaint object */ },
    "reply": { /* complaint reply record */ }
  }
}
```

**Status:** `Closed`

**Timeline Entry:** "Closed: {closure reason}"

**Socket Events:**
- `complaint:closed`
- `complaint:status-change`

**Fields Updated:**
- `status`: "Closed"
- `closedAt`: Current timestamp

---

## Socket Events

### complaint:accepted
Emitted when complaint is accepted.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "acceptedAt": "2026-05-04T10:30:00Z",
  "actorRole": "TTR",
  "source": "officer-accept"
}
```

### complaint:status-change
Emitted when complaint status changes.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "previousStatus": "Submitted",
  "newStatus": "Accepted",
  "actorRole": "TTR",
  "source": "officer-accept"
}
```

### complaint:escalation
Emitted when complaint is escalated.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "escalationLevel": "RPF",
  "escalatedBy": "Officer Name",
  "escalatedAt": "2026-05-04T10:35:00Z",
  "actorRole": "TTR",
  "source": "officer-escalate-rpf"
}
```

### complaint:reassigned
Emitted when complaint is reassigned.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "reassignedFrom": "TTR",
  "reassignedTo": "RPF",
  "reason": "Requires RPF expertise",
  "reassignedBy": "Officer Name",
  "reassignedAt": "2026-05-04T10:40:00Z",
  "source": "officer-reassign"
}
```

### complaint:resolved
Emitted when complaint is resolved.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "resolutionDetails": "Item found and handed over",
  "resolvedBy": "Officer Name",
  "resolvedAt": "2026-05-04T10:45:00Z",
  "actorRole": "TTR",
  "source": "officer-resolve"
}
```

### complaint:closed
Emitted when complaint is closed.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "closureReason": "Case closed successfully",
  "closedBy": "Officer Name",
  "closedAt": "2026-05-04T11:00:00Z",
  "actorRole": "TTR",
  "source": "officer-close"
}
```

### complaint:note-added
Emitted when internal note is added.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "note": "Note text",
  "actorRole": "TTR",
  "source": "officer-note"
}
```

### complaint:reply
Emitted when officer replies to complaint.
```json
{
  "complaintId": "...",
  "passengerId": "...",
  "complaint": { /* full complaint object */ },
  "reply": { /* reply record */ },
  "actorRole": "TTR",
  "source": "officer-response"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "status": 400,
  "message": "Invalid unit for reassignment",
  "error": "VALIDATION_ERROR"
}
```

### 403 Forbidden
```json
{
  "status": 403,
  "message": "On-duty officer access required.",
  "error": "OFFICER_OFF_DUTY"
}
```

### 404 Not Found
```json
{
  "status": 404,
  "message": "Complaint not found",
  "error": "NOT_FOUND"
}
```

### 500 Server Error
```json
{
  "status": 500,
  "message": "Unable to accept complaint.",
  "error": "INTERNAL_ERROR",
  "details": "error message"
}
```

---

## Action Logging

All actions are logged in the ActionLog collection with:
- `action`: Action name (e.g., "OFFICER_ACCEPTED_COMPLAINT")
- `actorType`: "OFFICER"
- `actorId`: Officer email or professional ID
- `actorRole`: Officer duty unit (TTR, RPF, Police, etc.)
- `entityType`: "Complaint"
- `entityId`: Complaint MongoDB ID
- `complaintId`: Complaint ID string
- `metadata`: Additional action-specific data

---

## Timeline Updates

Each action automatically adds an entry to the complaint's `messages` array:
```json
{
  "staffId": "officer-id",
  "staffName": "Officer Name",
  "text": "Action description",
  "timestamp": "2026-05-04T10:30:00Z",
  "isInternalNote": false
}
```

Timeline entries are sorted by timestamp (newest first) and displayed in real-time to all connected clients.
