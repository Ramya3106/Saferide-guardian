# SafeRide Guardian - Setup Guide

## 🎯 Overview

SafeRide Guardian is an automated lost item recovery system for Indian public transport with QR code verification, AI-powered routing, and real-time tracking.

## ✅ Latest Updates

- Fixed QR code scanning error with automatic retry mechanism
- Added network connectivity monitoring
- Implemented fast navigation system
- Enhanced error handling and user feedback

---

## 🚀 Quick Start (3 Steps)

### Step 1: Start Backend Server

```bash
cd server
npm install
npm start
```

✅ Wait for: `SafeRide Guardian SERVER STARTED on port 5000`

### Step 2: Start Frontend (New Terminal)

```bash
cd client
npm install
npm start
```

✅ Wait for: Metro Bundler to show QR code

### Step 3: Scan on Android Phone

1. Open **Expo Go** app
2. Tap **"Scan QR code"**
3. Point at terminal QR code
4. App loads and works smoothly! ✅

---

## 📁 Project Structure

```
Saferide-guardian/
├── server/
│   ├── index.js                 (Main server)
│   ├── models/                  (DB schemas)
│   ├── routes/                  (API endpoints)
│   └── services/                (Business logic)
├── client/
│   ├── App.js                   (Main app)
│   ├── src/
│   │   ├── screens/             (UI screens)
│   │   ├── services/            (API, network)
│   │   ├── components/          (UI components)
│   │   └── context/             (Auth state)
│   └── package.json
├── uploads/                     (File storage)
└── .env                         (Environment vars)
```

---

## 🔧 Configuration

### Backend (.env in server directory)

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/saferide
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

### Frontend (.env in client directory)

```
EXPO_PUBLIC_API_BASE_URL=http://your-ip:5000/api
```

---

## 📱 Features

### ✅ QR Code Scanning

- Real-time QR detection
- Automatic error recovery
- Manual ID entry fallback
- Network status indicators

### ✅ Network Resilience

- Auto-retry on failure (3 attempts)
- Exponential backoff timing
- Real-time connection monitoring
- Graceful offline handling

### ✅ Fast Navigation

- Quick-access menu panel
- One-tap navigation
- Role-based menu items

### ✅ Real-time Updates

- Socket.io for live data
- Auto-reconnection
- Pull-to-refresh support

---

## 🧪 Testing

### Test QR Scanning

1. Login to app
2. Tap Fast Nav → "📷 Scan QR Code"
3. Scan a QR code or use "Manual Entry"
4. Should navigate to complaint details

### Test Network Handling

1. Turn Airplane mode ON
2. See "❌ No Internet" banner
3. Turn Airplane mode OFF
4. See auto-retry and recovery

### Test Error Recovery

1. Stop backend server
2. Try to load complaint
3. See retry messages
4. Restart server
5. Auto-recovery works

---

## 🐛 Troubleshooting

| Issue                | Solution                         |
| -------------------- | -------------------------------- |
| Port 8081 in use     | `taskkill /F /IM node.exe /T`    |
| Dependencies missing | `npm install --legacy-peer-deps` |
| Expo cache issues    | `npx expo start -c`              |
| Server not found     | Ensure server runs on port 5000  |
| QR not scanning      | Check lighting, use manual entry |

---

## 📊 API Endpoints

| Method | Endpoint                   | Description           |
| ------ | -------------------------- | --------------------- |
| POST   | /api/auth/register         | Register user         |
| POST   | /api/auth/login            | Login                 |
| POST   | /api/complaints            | Create complaint      |
| GET    | /api/complaints/my         | Get user complaints   |
| GET    | /api/complaints/:id        | Get complaint details |
| PATCH  | /api/complaints/:id/status | Update status         |
| GET    | /api/alerts/my             | Get alerts            |

---

## 💾 Database Schema

### User

```javascript
{
  name, email, password, phone,
  role: 'user' | 'driver' | 'staff' | 'admin',
  vehicleId, createdAt
}
```

### Complaint

```javascript
{
  userId, itemType, itemDescription, itemPhotos,
  status: 'reported' | 'alerted' | 'located' | 'secured' | 'returned',
  priority: 'critical' | 'high' | 'medium' | 'low',
  geoLocation, vehicleType, vehicleNumber,
  handoffQRCode, recoveredBy, recoveredAt
}
```

---

## 🔐 Security

- JWT token-based authentication
- Password hashing with bcrypt
- CORS enabled for API access
- Input validation on all endpoints
- Secure QR code verification

---

## 📈 Performance

- 3x retry mechanism for reliability
- 30-second timeout for slow networks
- Real-time socket.io updates
- Cached base URL to reduce calculations
- Exponential backoff prevents cascading failures

---

## 🎯 Next Steps

1. ✅ Complete setup using Quick Start
2. ✅ Test all features from Testing section
3. ✅ Check troubleshooting if issues occur
4. ✅ Deploy to production when ready

---

## 📞 Support

For issues:

1. Check console logs
2. Verify server is running
3. Check network connection
4. Review troubleshooting section
5. Check error messages for guidance

---

**Version:** 2.1.0  
**Status:** ✅ Production Ready  
**Last Updated:** January 30, 2026
