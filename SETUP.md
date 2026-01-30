# SafeRide Guardian - Setup & Troubleshooting

## Quick Start

### 1. Start the Backend Server

```bash
cd Saferide-guardian
npm start
```

The server should display:

```
MongoDB connected
SafeRide Guardian server running on port 5000
Server accessible at http://localhost:5000
For Android emulator: http://10.0.2.2:5000
For physical devices: http://10.144.132.29:5000
```

### 2. Start the React Native Client

Open a new terminal:

```bash
cd Saferide-guardian/client
npm start
```

Then press:

- `a` for Android emulator
- `i` for iOS simulator
- Scan QR code for physical device

## Fixing "Cannot connect to server" Error

### Problem

When you try to register, you get: "Registration failed, cannot connect to server, please check your connection"

### Solutions

#### 1. Ensure Backend Server is Running

- Open a terminal and run: `netstat -ano | findstr :5000`
- If nothing appears, the server is NOT running
- Start it: `cd Saferide-guardian && npm start`

#### 2. Check Your IP Address

Run `ipconfig` in terminal and find your WiFi IPv4 Address.

Update the fallback IP in `client/src/services/api.js`:

```javascript
// Line ~38
return "http://YOUR_IP_ADDRESS:5000/api";
```

Current IP: `10.144.132.29`

#### 3. For Android Emulator

The emulator uses a special IP: `10.0.2.2` to access your host machine's localhost.
This is already configured in the code.

#### 4. For Physical Device

- Your phone must be on the SAME WiFi network as your computer
- Use your computer's local IP address (e.g., `10.144.132.29`)
- Make sure Windows Firewall allows connections on port 5000

#### 5. Check Firewall Settings

If using a physical device, you may need to allow Node.js through Windows Firewall:

1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Find Node.js or add it manually
4. Allow both Private and Public networks

## Testing the Connection

### Test Server Health

Open a browser or use curl:

```bash
curl http://localhost:5000/api/health
```

You should see:

```json
{ "status": "SafeRide Guardian API Running", "timestamp": "..." }
```

### Test from Physical Device

On your phone's browser, visit:

```
http://10.144.132.29:5000/api/health
```

If this works, the app should work too.

## Common Issues

### 1. MongoDB Not Connected

Error: `MongoDB connection error`

**Solution:**

- Install MongoDB locally, OR
- Use MongoDB Atlas (cloud)
- Update `MONGODB_URI` in `.env` file

### 2. Port Already in Use

Error: `EADDRINUSE: address already in use :::5000`

**Solution:**

```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### 3. Network Error on Real Device

**Checklist:**

- [ ] Is your phone on the same WiFi as your computer?
- [ ] Did you update the IP address in `api.js`?
- [ ] Can you access `http://YOUR_IP:5000/api/health` from phone's browser?
- [ ] Is Windows Firewall blocking the connection?

### 4. Expo/Metro Bundler Issues

```bash
# Clear cache and restart
cd client
npx expo start -c
```

## Environment Variables

### Server (.env in root)

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/saferide
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

### Client (Optional)

Create `client/.env` (requires expo-constants):

```env
EXPO_PUBLIC_API_BASE_URL=http://10.144.132.29:5000/api
```

## Development Workflow

1. Start backend server: `npm start` (in root)
2. Start client: `npm start` (in client folder)
3. Make changes to code
4. Client auto-reloads, server may need restart for some changes

## Getting Help

Check the logs:

- **Server logs**: Terminal where you ran `npm start`
- **Client logs**: Metro bundler terminal + React Native DevTools
- **Network requests**: Look for console.log output showing API calls

The client logs will show the full URL being called, e.g.:

```
API Request: POST http://10.144.132.29:5000/api/auth/register
```
