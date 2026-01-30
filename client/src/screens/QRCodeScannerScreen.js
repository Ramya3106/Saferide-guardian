import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import api from "../services/api";
import networkService from "../services/networkService";

export default function QRCodeScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manualId, setManualId] = useState("");
  const cameraRef = useRef();

  const MAX_RETRIES = 3;

  useEffect(() => {
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

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);

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
          },
        },
        {
          text: "Cancel",
          onPress: () => {
            setScanned(false);
            setLoading(false);
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

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission not granted</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
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
          // Use inline modal for cross-platform manual entry
          setShowManual(true);
          setManualId("");
        }}
      >
        <Text style={styles.manualButtonText}>📋 Manual Entry</Text>
      </TouchableOpacity>

      {showManual && (
        <View style={styles.manualOverlay}>
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>Enter Complaint ID</Text>
            <TextInput
              style={styles.manualInput}
              placeholder="24-char Complaint ID"
              placeholderTextColor="#aaa"
              value={manualId}
              onChangeText={setManualId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.manualActions}>
              <TouchableOpacity
                style={[styles.smallButton, styles.cancelButton]}
                onPress={() => {
                  setShowManual(false);
                  setScanned(false);
                }}
              >
                <Text style={styles.smallButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallButton, styles.confirmButton]}
                onPress={() => {
                  const id = manualId.trim();
                  if (id) {
                    setShowManual(false);
                    navigation.replace("ComplaintDetail", { id });
                    setScanned(false);
                  }
                }}
              >
                <Text style={styles.smallButtonText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  manualOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  manualCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  manualTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  manualInput: {
    backgroundColor: "#111",
    color: "#fff",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
  },
  manualActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  smallButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#444",
  },
  confirmButton: {
    backgroundColor: "#e94560",
  },
  smallButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
