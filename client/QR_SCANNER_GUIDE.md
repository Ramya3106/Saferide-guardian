# QR Scanner Implementation Guide

A complete QR code scanning solution for SafeRide Guardian mobile app built with Expo and React Native.

## 📦 Components

### 1. **QRScannerScreen** (`src/screens/QRScannerScreen.js`)
The main scanner component that handles camera operations and QR detection.

**Features:**
- Real-time QR code scanning
- Animated scanning line effect
- Corner frame decorations
- Permission handling
- Scanned data display
- Scan again functionality

**Usage:**
```javascript
import QRScannerScreen from './src/screens/QRScannerScreen';

// In your navigation stack
<Stack.Screen name="QRScanner" component={QRScannerScreen} />

// Navigate to scanner
navigation.navigate('QRScanner', {
  onScanComplete: (data) => {
    console.log('Scanned data:', data);
  }
});
```

### 2. **QRScannerButton** (`src/components/QRScannerButton.js`)
Reusable button component to trigger QR scanning.

**Props:**
- `onPress`: Function called when button is pressed
- `loading`: Boolean to show loading state
- `variant`: 'primary' | 'secondary' | 'icon'
- `size`: 'small' | 'medium' | 'large'
- `label`: Button text label

**Usage:**
```javascript
import QRScannerButton from './src/components/QRScannerButton';

// Primary button
<QRScannerButton
  onPress={() => navigation.navigate('QRScanner')}
  variant="primary"
  size="large"
  label="Scan QR Code"
/>

// Icon button
<QRScannerButton
  onPress={() => navigation.navigate('QRScanner')}
  variant="icon"
/>

// Secondary button
<QRScannerButton
  onPress={() => navigation.navigate('QRScanner')}
  variant="secondary"
  size="medium"
  label="Quick Scan"
/>
```

### 3. **useQRScanner Hook** (`src/hooks/useQRScanner.js`)
Custom hook for managing QR scanning state and history.

**Returns:**
- `isScanning`: Current scanning state
- `setIsScanning`: Set scanning state
- `lastScannedData`: Last successfully scanned data
- `scanHistory`: Array of previous scans with timestamps
- `handleScan`: Function to process scanned data
- `clearHistory`: Clear all scan history
- `removeFromHistory`: Remove specific scan from history

**Usage:**
```javascript
import { useQRScanner } from './src/hooks/useQRScanner';

const MyComponent = () => {
  const { 
    scanHistory, 
    lastScannedData, 
    handleScan, 
    clearHistory 
  } = useQRScanner();

  return (
    <View>
      <Text>Last scan: {lastScannedData}</Text>
      <FlatList
        data={scanHistory}
        renderItem={({ item }) => <Text>{item.data}</Text>}
      />
      <Button title="Clear" onPress={clearHistory} />
    </View>
  );
};
```

### 4. **QRScannerExampleScreen** (`src/screens/QRScannerExampleScreen.js`)
Complete example integration screen showing all components in action.

## 🚀 Quick Start

### 1. Add to Navigation Stack
```javascript
import QRScannerScreen from './src/screens/QRScannerScreen';
import QRScannerExampleScreen from './src/screens/QRScannerExampleScreen';

// In your navigator
<Stack.Screen name="QRScanner" component={QRScannerScreen} />
<Stack.Screen name="QRExample" component={QRScannerExampleScreen} />
```

### 2. Basic Integration
```javascript
import { useNavigation } from '@react-navigation/native';
import QRScannerButton from './src/components/QRScannerButton';

const MyDashboard = () => {
  const navigation = useNavigation();

  return (
    <View>
      <QRScannerButton
        onPress={() => navigation.navigate('QRScanner')}
        label="Scan Complaint ID"
      />
    </View>
  );
};
```

### 3. Advanced Integration with State
```javascript
import { useNavigation } from '@react-navigation/native';
import { useQRScanner } from './src/hooks/useQRScanner';
import QRScannerButton from './src/components/QRScannerButton';

const ComplaintLookup = () => {
  const navigation = useNavigation();
  const { lastScannedData, handleScan } = useQRScanner();

  const scanComplaint = () => {
    navigation.navigate('QRScanner', {
      onScanComplete: (data) => {
        handleScan(data);
        // Fetch complaint data
        fetchComplaintById(data);
      }
    });
  };

  return (
    <View>
      <QRScannerButton
        onPress={scanComplaint}
        label="Scan Complaint QR"
      />
      {lastScannedData && (
        <ComplaintDetails id={lastScannedData} />
      )}
    </View>
  );
};
```

## 🔧 Configuration

### Camera Permissions
The scanner automatically handles camera permissions. Make sure your `app.json` includes:
```json
{
  "permissions": ["camera"]
}
```

### QR Code Types
Currently configured to detect QR codes. To support other barcode types, modify `QRScannerScreen.js`:

```javascript
barcodeScannerSettings={{
  barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8"]
}}
```

## 📱 Integration Examples

### Officer Dashboard Integration
```javascript
// OfficerDashboardScreen.js
import QRScannerButton from '../components/QRScannerButton';

const QuickScan = ({ navigation }) => (
  <QRScannerButton
    onPress={() => navigation.navigate('QRScanner')}
    variant="icon"
  />
);
```

### Passenger Dashboard Integration
```javascript
// PassengerDashboard.js
import QRScannerButton from './src/components/QRScannerButton';

const ScanComplaint = ({ navigation }) => (
  <View style={styles.scanSection}>
    <Text style={styles.title}>Track Your Complaint</Text>
    <QRScannerButton
      onPress={() => navigation.navigate('QRScanner')}
      variant="primary"
      label="Scan Complaint QR Code"
    />
  </View>
);
```

### Complaint Details Integration
```javascript
// ComplaintDetailView.js
const LinkedScan = ({ navigation, complaintId }) => {
  const { handleScan } = useQRScanner();

  return (
    <QRScannerButton
      onPress={() => 
        navigation.navigate('QRScanner', {
          onScanComplete: (data) => {
            if (data === complaintId) {
              handleScan(data);
              showSuccess('Complaint verified!');
            }
          }
        })
      }
      label="Verify with QR"
    />
  );
};
```

## 🎨 Styling & Customization

All components use Tailwind/NativeWind. Modify colors in component styles:

```javascript
// QRScannerButton.js
variant_primary: {
  backgroundColor: "#3B82F6",  // Change primary color
},

// QRScannerScreen.js
const cornerColor = "#22C55E";  // Change corner color
const scanLineColor = "#22C55E";  // Change scan line color
```

## 🐛 Troubleshooting

### Camera Permission Not Granted
- Check `app.json` has proper permissions
- iOS: Check Privacy > Camera in Info.plist
- Android: Check manifest permissions

### QR Code Not Detected
- Ensure proper lighting
- QR code should be clear and undamaged
- Try adjusting camera distance

### Performance Issues
- Close background apps
- Clear Expo cache: `expo start --clear`
- Reduce camera frame rate if needed

## 📄 Dependencies
- `expo-camera@~17.0.10`
- `react-navigation` (for navigation integration)
- `expo` (base package)

## 💡 Best Practices

1. Always handle camera permissions gracefully
2. Provide visual feedback during scanning
3. Store scan history for audit trail
4. Validate scanned data before processing
5. Implement error boundaries around scanner screens

## 🔐 Security Considerations

- Never log sensitive QR code data
- Validate scanned data server-side
- Implement rate limiting for API calls
- Use encrypted storage for scan history
- Clear history when user logs out

---

**Last Updated:** May 7, 2026
