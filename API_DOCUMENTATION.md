# Passenger Dashboard API Documentation

## Overview
All requests must include the `X-User-Email` header with the passenger's email address for authentication.

---

## Endpoints

### 1. GET `/api/passenger/dashboard`
Get the passenger's active journey information.

**Headers:**
```
X-User-Email: user@example.com
```

**Response:**
```json
{
  "journey": {
    "_id": "507f1f77bcf86cd799439011",
    "vehicleNumber": "TN-01-AB-1234",
    "route": "Velachery → CMBT",
    "fromStop": "Velachery",
    "toStop": "CMBT",
    "currentStop": "Medavakkam",
    "driverName": "Driver Name",
    "conductorName": "Conductor Name",
    "estimatedDuration": "2h 15min",
    "status": "Active",
    "startTime": "2024-02-09T10:00:00Z",
    "estimatedEndTime": "2024-02-09T12:15:00Z"
  },
  "message": "Journey retrieved successfully"
}
```

---

### 2. POST `/api/passenger/complaints`
Create a new complaint for a lost item.

**Headers:**
```
X-User-Email: user@example.com
X-User-Name: Passenger Name
```

**Body:**
```json
{
  "itemType": "Phone",
  "description": "iPhone 13 Pro, Space Gray, in black leather case",
  "lastSeenLocation": "Medavakkam Stop",
  "timestamp": "2024-02-09T10:30:00Z",
  "journeyId": "507f1f77bcf86cd799439011",
  "vehicleNumber": "TN-01-AB-1234",
  "route": "Velachery → CMBT"
}
```

**Response:**
```json
{
  "complaint": {
    "_id": "507f1f77bcf86cd799439012",
    "itemType": "Phone",
    "description": "iPhone 13 Pro, Space Gray, in black leather case",
    "status": "Staff Notified",
    "vehicleNumber": "TN-01-AB-1234",
    "route": "Velachery → CMBT",
    "staffName": "Conductor Priya S",
    "staffEta": "8 mins",
    "qrCode": "QR-1707475800000-abc123def",
    "createdAt": "2024-02-09T10:30:00Z"
  },
  "message": "Complaint created successfully"
}
```

---

### 3. GET `/api/passenger/complaints`
Get all complaints for the logged-in passenger.

**Headers:**
```
X-User-Email: user@example.com
```

**Response:**
```json
{
  "complaints": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "itemType": "Phone",
      "description": "iPhone 13 Pro",
      "status": "Recovered",
      "vehicleNumber": "TN-01-AB-1234",
      "route": "Velachery → CMBT",
      "createdAt": "2024-02-09T10:30:00Z"
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "itemType": "Wallet",
      "description": "Brown leather wallet",
      "status": "Closed",
      "vehicleNumber": "TN-01-AB-5678",
      "route": "Egmore → Tambaram",
      "createdAt": "2024-02-08T14:20:00Z"
    }
  ],
  "message": "Complaints retrieved successfully"
}
```

---

### 4. GET `/api/passenger/complaints/:id`
Get specific complaint details.

**Headers:**
```
X-User-Email: user@example.com
```

**Response:**
```json
{
  "complaint": {
    "_id": "507f1f77bcf86cd799439012",
    "itemType": "Phone",
    "description": "iPhone 13 Pro, Space Gray",
    "status": "Recovered",
    "vehicleNumber": "TN-01-AB-1234",
    "route": "Velachery → CMBT",
    "lastSeenLocation": "Medavakkam",
    "staffName": "Conductor Priya S",
    "staffNotified": true,
    "itemFound": true,
    "meetingScheduled": true,
    "itemCollected": true,
    "meetingPoint": "Guindy Station",
    "meetingTime": "10:15 AM",
    "messages": [
      {
        "staffName": "Conductor Priya S",
        "text": "Item is SAFE ✅",
        "timestamp": "2024-02-09T10:35:00Z"
      },
      {
        "staffName": "Conductor Priya S",
        "text": "Collect at Guindy – 10:15 AM",
        "timestamp": "2024-02-09T10:40:00Z"
      }
    ],
    "createdAt": "2024-02-09T10:30:00Z"
  },
  "message": "Complaint retrieved successfully"
}
```

---

### 5. GET `/api/passenger/tracking/:complaintId`
Get live tracking information for a complaint.

**Headers:**
```
X-User-Email: user@example.com
```

**Response:**
```json
{
  "tracking": {
    "complaintId": "507f1f77bcf86cd799439012",
    "staffLocation": {
      "latitude": 13.0089,
      "longitude": 80.2588,
      "lastUpdated": "2024-02-09T10:45:00Z"
    },
    "meetingPoint": "Guindy Station",
    "staffEta": "8 mins",
    "itemStatus": "Found ✅"
  },
  "message": "Tracking data retrieved successfully"
}
```

---

### 6. GET `/api/passenger/messages/:complaintId`
Get staff messages for a complaint.

**Headers:**
```
X-User-Email: user@example.com
```

**Response:**
```json
{
  "messages": [
    {
      "staffName": "Conductor Priya S",
      "text": "Item is SAFE ✅",
      "timestamp": "2024-02-09T10:35:00Z"
    },
    {
      "staffName": "Conductor Priya S",
      "text": "Collect at Guindy – 10:15 AM",
      "timestamp": "2024-02-09T10:40:00Z"
    },
    {
      "staffName": "Conductor Priya S",
      "text": "Please bring ID proof",
      "timestamp": "2024-02-09T10:42:00Z"
    }
  ],
  "staffName": "Conductor Priya S",
  "message": "Messages retrieved successfully"
}
```

---

### 7. POST `/api/passenger/messages/:complaintId`
Send a message to staff about the complaint.

**Headers:**
```
X-User-Email: user@example.com
```

**Body:**
```json
{
  "text": "I'm on my way to Guindy Station"
}
```

**Response:**
```json
{
  "message": "Message sent successfully",
  "messages": [
    {
      "staffName": "Conductor Priya S",
      "text": "Item is SAFE ✅",
      "timestamp": "2024-02-09T10:35:00Z"
    }
  ]
}
```

---

### 8. POST `/api/passenger/qr-code/:complaintId`
Verify QR code and mark item as collected.

**Headers:**
```
X-User-Email: user@example.com
```

**Response:**
```json
{
  "message": "Item collected successfully!",
  "complaint": {
    "_id": "507f1f77bcf86cd799439012",
    "status": "Recovered",
    "itemCollected": true,
    "updatedAt": "2024-02-09T10:50:00Z"
  }
}
```

---

### 9. POST `/api/passenger/gps`
Update or toggle GPS status for tracking.

**Headers:**
```
X-User-Email: user@example.com
```

**Body:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "gpsEnabled": true,
  "message": "GPS enabled"
}
```

---

### 10. POST `/api/passenger/journey`
Create a new journey record when passenger starts a trip.

**Headers:**
```
X-User-Email: user@example.com
```

**Body:**
```json
{
  "vehicleNumber": "TN-01-AB-1234",
  "route": "Velachery → CMBT",
  "fromStop": "Velachery",
  "toStop": "CMBT",
  "driverName": "Driver Name",
  "conductorName": "Conductor Name",
  "estimatedDuration": "2h 15min"
}
```

**Response:**
```json
{
  "journey": {
    "_id": "507f1f77bcf86cd799439014",
    "vehicleNumber": "TN-01-AB-1234",
    "route": "Velachery → CMBT",
    "status": "Active",
    "startTime": "2024-02-09T10:00:00Z",
    "estimatedEndTime": "2024-02-09T12:15:00Z"
  },
  "message": "Journey created successfully"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "User email required"
}
```

### 404 Not Found
```json
{
  "message": "Complaint not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Error creating complaint"
}
```

---

## Status Values

- **Complaint Statuses:** Reported, Staff Notified, Found, Meeting Scheduled, Recovered, Closed
- **Journey Statuses:** Active, Completed, Cancelled
- **Item Types:** Phone, Wallet, Bag, Documents, Other

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Complaint tracking includes simulated staff location data
- QR codes are auto-generated upon complaint creation
- Each request requires valid X-User-Email header
