import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { io } from "socket.io-client";
import api from "../services/api";

// Get the socket URL based on platform
const getSocketURL = () => {
  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:5000";
    }
    return "http://localhost:5000";
  }
  return "http://192.168.1.5:5000";
};

export default function ComplaintDetailScreen({ route }) {
  const { id } = route.params;
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchComplaint();

    try {
      const socket = io(getSocketURL());
      socket.emit("join-complaint", id);
      socket.on("status-update", (updated) => {
        setComplaint(updated);
      });

      return () => socket.disconnect();
    } catch (err) {
      console.error("Socket connection error:", err);
    }
  }, [id]);

  async function fetchComplaint() {
    try {
      const response = await api.get(`/complaints/${id}`);
      setComplaint(response.data);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch complaint:", error);
      setError(error.message || "Failed to load complaint");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>Check your connection and try again</Text>
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

  const statusSteps = ["reported", "alerted", "located", "secured", "returned"];
  const currentIndex = statusSteps.indexOf(complaint.status);

  return (
    <ScrollView style={styles.container}>
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
        {statusSteps.map((step, i) => (
          <View key={step} style={styles.timelineItem}>
            <View style={[styles.dot, i <= currentIndex && styles.dotActive]} />
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
        ))}
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
                source={{ uri: `http://localhost:5000/${photo}` }}
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
  },
  errorText: {
    color: "#e94560",
    fontSize: 16,
  },
  errorHint: {
    color: "#8b8b8b",
    fontSize: 14,
    marginTop: 10,
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
