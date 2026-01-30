# SafeRide Guardian App - Fast Navigation Guide

## Quick Navigation

### Main Screens

1. **Home** - Dashboard with quick actions
2. **Report** - Report a lost item
3. **My Complaints** - View your reports
4. **Alerts** - Receive item alerts
5. **Profile** - Account settings

### Navigation Shortcuts

| Screen        | How to Access   | Time |
| ------------- | --------------- | ---- |
| Home          | Tap house icon  | <1s  |
| Report Item   | Tap + button    | <1s  |
| My Complaints | Tap list icon   | <1s  |
| Alerts        | Tap bell icon   | <1s  |
| Profile       | Tap person icon | <1s  |

---

## Getting Started Fast

### 1. Register Account (First Time)

```
1. Tap "Register" on Login screen
2. Fill in:
   - Name: Your full name
   - Phone: 10-digit number
   - Password: 6+ characters
   - Role: Choose (Passenger/Driver/etc)
3. Tap "Register"
4. Logged in automatically!
```

### 2. Report a Lost Item

```
1. Tap "+" or "Report" button
2. Take photo (or choose from gallery)
3. Fill details:
   - Item name
   - Description
   - Last seen location
   - Category (bag, phone, wallet, etc)
4. Tap "Submit"
5. Report sent!
```

### 3. View Your Reports

```
1. Tap "My Complaints"
2. See all your reports
3. Tap any report to see:
   - Status (Open/In Progress/Resolved)
   - Photos
   - Description
   - Comments
```

### 4. Receive Alerts

```
1. Tap "Alerts"
2. Enable notifications
3. Get instant alerts when items match
4. Tap to view matching items
```

---

## Keyboard Shortcuts (When Available)

| Action  | Shortcut                    |
| ------- | --------------------------- |
| Go Home | Tap House Icon              |
| Add New | Tap + Button                |
| Refresh | Pull down to refresh        |
| Back    | Tap Back Arrow              |
| Logout  | Profile → Settings → Logout |

---

## Performance Tips

- **App loads slowly first time?** Normal - it's downloading files. Wait 30-60 seconds.
- **Photos slow to load?** Check WiFi connection
- **Notifications not working?** Enable in phone Settings → Notifications
- **Need to fast reload?** Shake phone or press 'm' in Metro window (dev mode)

---

## Troubleshooting Navigation

### Screen shows loading spinner forever

- Close Expo Go app
- Reopen Expo Go
- Rescan QR code

### Can't tap buttons

- Wait 5 seconds for screen to fully load
- Check if screen is loading (spinner visible)

### App crashes after action

- Note what you were doing
- Check Metro window for errors
- Report the issue

### Navigation feels slow

- Check WiFi connection
- Restart app (close and reopen)
- Ensure backend server is running

---

## Recommended Workflow

### For Finding Lost Items

```
1. Home → View recent items
2. Tap item to see details
3. Contact owner if match
4. Update status when resolved
```

### For Reporting Lost Item

```
1. Home → Tap "Report"
2. Take clear photo
3. Fill detailed description
4. Include location and time
5. Submit and wait for matches
```

### For Managing Reports

```
1. My Complaints → View all
2. See status of each
3. Read comments from others
4. Update when found
```

---

## Fast Tips

⚡ **Speed Up App:**

- Close unnecessary apps on phone
- Ensure good WiFi signal
- Restart app if slow
- Use USB connection for development

⚡ **Speed Up Scanning:**

- Hold phone steady
- Ensure good lighting
- Center QR code in frame
- Wait for beep/success message

⚡ **Speed Up Registration:**

- Prepare info before opening
- Use simple password
- Choose role carefully
- Tap once on submit button

---

## Contact & Support

- **App Issues?** Check Metro window logs
- **Server Down?** Check backend terminal
- **Network Issues?** Use tunnel mode
- **Stuck?** Restart app or use USB connection

---

**For complete setup instructions, see:** `START-ALL.bat` or `COMPLETE-SOLUTION.md`

**Quick commands:**

```
# Start everything
Double-click: START-ALL.bat

# Manual start
cd client && npx expo start --tunnel

# Then scan QR with Expo Go
```

---

**App loads fast after first 60 seconds. Enjoy SafeRide Guardian!**
