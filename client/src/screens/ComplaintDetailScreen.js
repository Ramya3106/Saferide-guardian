import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { io } from "socket.io-client";
import Constants from "expo-constants";
import api, { getCurrentBaseURL } from "../services/api";
import networkService from "../services/networkService";

// Get the socket URL based on platform with multiple fallbacks
const getSocketURL = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoConfig?.extra?.expoGo?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.hostUri ||
    Constants.manifest?.hostUri;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:5000`;
  }

  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:5000";
    }
    return "http://localhost:5000";
  }

  // Fallback for production
  return "http://localhost:5000";
};

export default function ComplaintDetailScreen({ route }) {
  const { id } = route.params;
  const apiBase = getCurrentBaseURL();
  const serverBase = apiBase.replace(/\/api$/, "");
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const socketRef = useRef(null);
  const socketConnectAttempts = useRef(0);
  const MAX_SOCKET_ATTEMPTS = 3;

  useEffect(() => {
    fetchComplaint();
    networkService.initialize();

    const networkUnsubscribe = networkService.subscribe((connected) => {
      setIsConnected(connected);
      if (connected && !complaint) {
        // Retry fetching if network comes back
        fetchComplaint();
      }
    });

    initializeSocket();

    return () => {
      networkUnsubscribe();
      networkService.destroy();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  const initializeSocket = () => {
    try {
      const socketURL = getSocketURL();
      console.log("[Socket] Connecting to:", socketURL);

      socketRef.current = io(socketURL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 10000,
        transports: ["websocket", "polling"], // Fallback to polling
      });

      socketRef.current.on("connect", () => {
        console.log("[Socket] Connected:", socketRef.current.id);
        socketConnectAttempts.current = 0;
        socketRef.current.emit("join-complaint", id);
      });

      socketRef.current.on("status-update", (updated) => {
        console.log("[Socket] Status update received:", updated);
        setComplaint(updated);
      });

      socketRef.current.on("error", (error) => {
        console.error("[Socket] Error:", error);
      });

      socketRef.current.on("disconnect", (reason) => {
        console.warn("[Socket] Disconnected:", reason);
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("[Socket] Connection error:", error);
        socketConnectAttempts.current += 1;
      });
    } catch (err) {
      console.error("[Socket] Initialization error:", err);
    }
  };

  async function fetchComplaint() {
    try {
      const response = await api.get(`/complaints/${id}`);
      setComplaint(response.data);
      setError(null);
    } catch (error) {
      console.error("[Complaint] Failed to fetch:", error);
      const errorMsg =
        error.userMessage || error.message || "Failed to load complaint";
      setError(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    fetchComplaint();
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading complaint details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>
          Check your connection and try again
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchComplaint}>
          <Text style={styles.retryButtonText}>🔄 Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Complaint not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#e94560"
        />
      }
    >
      {!isConnected && (
        <View style={styles.networkBanner}>
          <Text style={styles.networkBannerText}>
            ⚠️ No internet connection
          </Text>
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.itemType}>
          {complaint.itemType.charAt(0).toUpperCase() +
            complaint.itemType.slice(1)}
        </Text>
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: getPriorityColor(complaint.priority) },
          ]}
        >
          <Text style={styles.priorityText}>
            {complaint.priority.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>{complaint.itemDescription}</Text>

      {/* Status Timeline */}
      <View style={styles.timeline}>
        <Text style={styles.sectionTitle}>Status Timeline</Text>
        {["reported", "alerted", "located", "secured", "returned"].map(
          (step, i) => {
            const statusSteps = [
              "reported",
              "alerted",
              "located",
              "secured",
              "returned",
            ];
            const currentIndex = statusSteps.indexOf(complaint.status);
            return (
              <View key={step} style={styles.timelineItem}>
                <View
                  style={[styles.dot, i <= currentIndex && styles.dotActive]}
                />
                {i < statusSteps.length - 1 && (
                  <View
                    style={[styles.line, i < currentIndex && styles.lineActive]}
                  />
                )}
                <Text
                  style={[
                    styles.stepText,
                    i <= currentIndex && styles.stepTextActive,
                  ]}
                >
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </Text>
              </View>
            );
          },
        )}
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Vehicle</Text>
          <Text style={styles.detailValue}>
            {complaint.vehicleType} - {complaint.vehicleNumber || "N/A"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Last Seen</Text>
          <Text style={styles.detailValue}>
            {complaint.lastSeenLocation || "N/A"}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Reported</Text>
          <Text style={styles.detailValue}>
            {new Date(complaint.createdAt).toLocaleString()}
          </Text>
        </View>
        {complaint.predictedNextStop && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Predicted Stop</Text>
            <Text style={styles.detailValue}>
              {complaint.predictedNextStop}
            </Text>
          </View>
        )}
      </View>

      {/* QR Code */}
      {complaint.handoffQRCode && (
        <View style={styles.qrSection}>
          <Text style={styles.sectionTitle}>Handoff QR Code</Text>
          <Image
            source={{ uri: complaint.handoffQRCode }}
            style={styles.qrCode}
          />
          <Text style={styles.qrHint}>Show this to verify item handoff</Text>
        </View>
      )}

      {/* Photos */}
      {complaint.itemPhotos?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {complaint.itemPhotos.map((photo, i) => (
              <Image
                key={i}
                source={{ uri: `${serverBase}/${photo}` }}
                style={styles.photo}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

function getPriorityColor(priority) {
  const colors = {
    critical: "#e74c3c",
    high: "#e67e22",
    medium: "#f1c40f",
    low: "#3498db",
  };
  return colors[priority] || "#95a5a6";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f23",
    padding: 20,
  },
  loading: {
    flex: 1,
    backgroundColor: "#0f0f23",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    color: "#8b8b8b",
    fontSize: 14,
    marginTop: 10,
  },
  errorText: {
    color: "#e94560",
    fontSize: 16,
    textAlign: "center",
  },
  errorHint: {
    color: "#8b8b8b",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#e94560",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  networkBanner: {
    backgroundColor: "#e94560",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  networkBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  itemType: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priorityText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  description: {
    color: "#8b8b8b",
    fontSize: 16,
    marginBottom: 25,
  },
  timeline: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#e94560",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#333",
    marginRight: 15,
  },
  dotActive: {
    backgroundColor: "#e94560",
  },
  line: {
    position: "absolute",
    left: 7,
    top: 16,
    width: 2,
    height: 30,
    backgroundColor: "#333",
  },
  lineActive: {
    backgroundColor: "#e94560",
  },
  stepText: {
    color: "#666",
    fontSize: 14,
  },
  stepTextActive: {
    color: "#fff",
  },
  section: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailLabel: {
    color: "#8b8b8b",
    fontSize: 14,
  },
  detailValue: {
    color: "#fff",
    fontSize: 14,
  },
  qrSection: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  qrCode: {
    width: 180,
    height: 180,
    marginBottom: 10,
  },
  qrHint: {
    color: "#8b8b8b",
    fontSize: 12,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 10,
  },
});
