import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
  Animated,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const QRScannerScreen = ({ onScanComplete, route }) => {
  const navigation = useNavigation();
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [scannedData, setScannedData] = useState(null);
  const scanlineAnimation = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get("window");
  const frameSize = Math.min(width, height) * 0.75;

  // Animate the scanning line
  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanlineAnimation, {
            toValue: frameSize - 10,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(scanlineAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [isScanning, frameSize, scanlineAnimation]);

  // Request camera permission
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  const handleBarCodeScanned = ({ type, data }) => {
    if (!isScanning) return;

    setIsScanning(false);
    setScannedData(data);

    // Call the callback if provided
    if (onScanComplete) {
      onScanComplete(data);
    } else {
      // Show alert with scanned data
      Alert.alert("QR Code Scanned", `Data: ${data}`, [
        {
          text: "Scan Again",
          onPress: () => {
            setIsScanning(true);
            setScannedData(null);
          },
        },
        {
          text: "Copy",
          onPress: () => {
            // Copy to clipboard if needed
            Alert.alert("Copied", "QR code data copied to clipboard");
          },
        },
        {
          text: "Close",
          onPress: () => navigation.goBack(),
          style: "cancel",
        },
      ]);
    }
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={80} color="#EF4444" />
          <Text style={styles.permissionText}>
            Camera permission is required to scan QR codes
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="close-circle" size={80} color="#EF4444" />
          <Text style={styles.permissionText}>
            Camera permission denied. Please enable it in settings.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.permissionButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          {/* Scanning Frame */}
          <View style={styles.scannerOverlay}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Animated scan line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanlineAnimation }],
                },
              ]}
            />
          </View>

          {/* Controls overlay */}
          <View style={styles.controlsOverlay}>
            <Text style={styles.instructions}>
              {isScanning
                ? "Point camera at QR code"
                : "QR Code scanned successfully"}
            </Text>

            {!isScanning && (
              <View style={styles.resultContainer}>
                <View style={styles.resultBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={40}
                    color="#22C55E"
                  />
                  <Text style={styles.resultText}>{scannedData}</Text>
                </View>

                <TouchableOpacity
                  style={styles.scanAgainButton}
                  onPress={() => {
                    setIsScanning(true);
                    setScannedData(null);
                  }}
                >
                  <Ionicons name="reload" size={20} color="white" />
                  <Text style={styles.scanAgainButtonText}>Scan Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </CameraView>
      </View>

      {/* Info panel */}
      <View style={styles.infoPanel}>
        <View style={styles.infoItem}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            Make sure the QR code is clearly visible
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1F2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  placeholder: {
    width: 44,
  },
  cameraContainer: {
    flex: 1,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerOverlay: {
    width: "75%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#22C55E",
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanLine: {
    width: "80%",
    height: 2,
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  controlsOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  instructions: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 20,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resultContainer: {
    alignItems: "center",
    gap: 16,
  },
  resultBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 2,
    borderColor: "#22C55E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    minWidth: 250,
  },
  resultText: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  scanAgainButton: {
    flexDirection: "row",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    gap: 8,
  },
  scanAgainButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  infoPanel: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    color: "#E5E7EB",
    fontSize: 14,
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    backgroundColor: "#000",
  },
  permissionText: {
    fontSize: 18,
    color: "#E5E7EB",
    textAlign: "center",
    marginVertical: 24,
    fontWeight: "500",
  },
  permissionButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default QRScannerScreen;
