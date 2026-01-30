import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import api from "../services/api";
import networkService from "../services/networkService";

export default function QRCodeScannerScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const scannerRef = useRef();

  const MAX_RETRIES = 3;

  useEffect(() => {
    requestCameraPermission();
    networkService.initialize();

    const unsubscribe = networkService.subscribe((connected) => {
      setIsConnected(connected);
      if (!connected) {
        Alert.alert(
          "No Internet",
          "Please check your internet connection and try again.",
        );
      }
    });

    return () => {
      unsubscribe();
      networkService.destroy();
    };
  }, []);

  const requestCameraPermission = async () => {
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission",
          "Camera permission is required to scan QR codes.",
          [{ text: "OK" }],
        );
      }
    } catch (error) {
      console.error("[QR Scanner] Permission error:", error);
      Alert.alert("Error", "Failed to request camera permission");
    }
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);
    setRetryCount(0);

    await processQRCode(data);
  };

  const processQRCode = async (qrData) => {
    try {
      // Check network before processing
      const networkAvailable = await networkService.isNetworkAvailable();
      if (!networkAvailable) {
        throw new Error(
          "No internet connection. Please check your network and try again.",
        );
      }

      console.log("[QR Scanner] Processing QR code:", qrData);

      // Parse the QR code - expecting format: saferide://complaint/{id}
      const complaintMatch = qrData.match(/complaint\/([a-f0-9]{24})/);

      if (!complaintMatch) {
        throw new Error(
          "Invalid QR code format. Please scan a valid SafeRide QR code.",
        );
      }

      const complaintId = complaintMatch[1];

      // Fetch complaint details with retry
      await fetchComplaintWithRetry(complaintId);
    } catch (error) {
      console.error("[QR Scanner] Error:", error.message || error);

      const errorMessage =
        error.userMessage || error.message || "Failed to process QR code";

      Alert.alert("Scan Failed", errorMessage, [
        {
          text: "Try Again",
          onPress: () => {
            setScanned(false);
            setLoading(false);
            setRetryCount(0);
          },
        },
        {
          text: "Cancel",
          onPress: () => {
            setScanned(false);
            setLoading(false);
            setRetryCount(0);
            navigation.goBack();
          },
        },
      ]);
    }
  };

  const fetchComplaintWithRetry = async (complaintId, attempt = 1) => {
    try {
      console.log(
        `[QR Scanner] Fetching complaint ${complaintId} (Attempt ${attempt}/${MAX_RETRIES})`,
      );

      const response = await api.get(`/complaints/${complaintId}`);

      console.log(
        "[QR Scanner] Complaint fetched successfully:",
        response.data,
      );

      // Success - navigate to detail screen
      Alert.alert("Success", "QR Code scanned successfully!", [
        {
          text: "View Details",
          onPress: () => {
            navigation.replace("ComplaintDetail", { id: complaintId });
          },
        },
      ]);

      setLoading(false);
    } catch (error) {
      console.error(`[QR Scanner] Attempt ${attempt} failed:`, error.message);

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[QR Scanner] Retrying in ${delay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchComplaintWithRetry(complaintId, attempt + 1);
      }

      // All retries failed
      throw error;
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission not granted</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={requestCameraPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        ref={scannerRef}
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFill}
      />

      {/* Overlay with scanning frame */}
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.instructionText}>Point camera at the QR code</Text>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Processing QR code...</Text>
        </View>
      )}

      {/* Network status indicator */}
      {!isConnected && (
        <View style={styles.networkError}>
          <Text style={styles.networkErrorText}>❌ No Internet Connection</Text>
        </View>
      )}

      {/* Manual input fallback */}
      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => {
          Alert.prompt(
            "Enter Complaint ID",
            "Paste the complaint ID from your QR code:",
            [
              {
                text: "Cancel",
                onPress: () => {
                  setScanned(false);
                },
              },
              {
                text: "View",
                onPress: (complaintId) => {
                  if (complaintId?.trim()) {
                    navigation.replace("ComplaintDetail", {
                      id: complaintId.trim(),
                    });
                  }
                  setScanned(false);
                },
              },
            ],
            "plain-text",
          );
        }}
      >
        <Text style={styles.manualButtonText}>📋 Manual Entry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 300,
    height: 300,
    borderWidth: 2,
    borderColor: "#e94560",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  instructionText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
  },
  errorText: {
    color: "#e94560",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#e94560",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  networkError: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(233, 69, 96, 0.9)",
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
  },
  networkErrorText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  manualButton: {
    position: "absolute",
    bottom: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "rgba(233, 69, 96, 0.9)",
    borderRadius: 8,
  },
  manualButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
