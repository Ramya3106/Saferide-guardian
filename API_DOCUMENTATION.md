# SafeRide Guardian API Documentation

## Overview
This document covers all API endpoints for the SafeRide Guardian application, including authentication, passenger dashboard, and password reset functionality.

---

## Authentication Endpoints

### 1. POST `/api/auth/send-verify-code`
Send a verification code to the user's email for registration.

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "sent": true,
  "devCode": "123456"
}
```

---

### 2. POST `/api/auth/verify-code`
Verify the email verification code.

**Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "verified": true
}
```

---

### 3. POST `/api/auth/register`
Register a new user account.

**Body:**
```json
{
  "role": "TTR/RPF/Police",
  "name": "Officer Name",
  "phone": "9876543210",
  "email": "officer@railnet.gov.in",
  "password": "securepassword",
  "professionalId": "TTR-TN-123456",
  "officialEmail": "officer@railnet.gov.in",
  "pnrRange": "PNR-001 to PNR-500",
  "jurisdiction": "Chennai Central Zone"
}
```

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "role": "TTR/RPF/Police",
  "email": "officer@railnet.gov.in",
  "approvalStatus": "pending"
}
```

---

### 4. POST `/api/auth/login`
Login to the application.

**Body (Password Login):**
```json
{
  "role": "TTR/RPF/Police",
  "professionalId": "TTR-TN-123456",
  "password": "securepassword",
  "method": "password"
}
```

**Body (OTP Login):**
```json
{
  "role": "TTR/RPF/Police",
  "email": "officer@railnet.gov.in",
  "otpCode": "123456",
  "method": "otp"
}
```

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "role": "TTR/RPF/Police",
  "email": "officer@railnet.gov.in",
  "name": "Officer Name"
}
```

---

### 5. POST `/api/auth/forgot-password`
Request a password reset code for TTR/RPF/Police users.

**Body:**
```json
{
  "role": "TTR/RPF/Police",
  "professionalId": "TTR-TN-123456",
  "officialEmail": "officer@railnet.gov.in"
}
```

**Response:**
```json
{
  "sent": true,
  "devCode": "654321"
}
```

**Notes:**
- Only available for TTR/RPF/Police role
- Reset code expires in 15 minutes
- Maximum 5 attempts allowed

---

### 6. POST `/api/auth/reset-password`
Reset password using the reset code (for forgot-password flow with professional ID).

**Body:**
```json
{
  "officialEmail": "officer@railnet.gov.in",
  "resetCode": "654321",
  "newPassword": "newsecurepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successful. You can now login."
}
```

**Notes:**
- Reset code must be valid and not expired
- New password must be at least 6 characters
- After successful reset, user can login with new password

---

### 7. POST `/api/auth/reset-password-otp`
Reset password using OTP verification (simplified flow for TTR/RPF/Police).

**Body:**
```json
{
  "officialEmail": "officer@railnet.gov.in",
  "otpCode": "123456",
  "newPassword": "newsecurepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successful. You can now login."
}
```

**Notes:**
- Uses the same OTP verification system as email verification
- OTP code expires in 10 minutes
- Maximum 5 attempts allowed
- Simpler flow - only requires official email, no professional ID needed
- After successful reset, user can login with new password

---

## Passenger Dashboard Endpoints

All passenger requests must include the `X-User-Email` header with the passenger's email address for authentication.

### 8. GET `/api/passenger/dashboard`
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

### 9. POST `/api/passenger/complaints`
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

### 10. GET `/api/passenger/complaints`
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

### 11. GET `/api/passenger/complaints/:id`
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

### 11. GET `/api/passenger/tracking/:complaintId`
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

### 12. GET `/api/passenger/messages/:complaintId`
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

### 13. POST `/api/passenger/messages/:complaintId`
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

### 14. POST `/api/passenger/qr-code/:complaintId`
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

### 15. POST `/api/passenger/gps`
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

### 16. POST `/api/passenger/journey`
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
