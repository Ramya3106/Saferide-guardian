import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await api.get("/alerts/my");
      setAlerts(response.data);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
    }, [fetchAlerts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await api.patch(`/alerts/${alertId}/acknowledge`);
      Alert.alert("Success", "Alert acknowledged");
      fetchAlerts();
    } catch (error) {
      Alert.alert("Error", "Failed to acknowledge alert");
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.channelBadge,
            { backgroundColor: getChannelColor(item.channel) },
          ]}
        >
          <Text style={styles.channelText}>
            {getChannelIcon(item.channel)} {item.channel.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.time}>
          {new Date(item.createdAt).toLocaleTimeString()}
        </Text>
      </View>

      <Text style={styles.message}>{item.message}</Text>

      {item.complaintId && (
        <View style={styles.complaintInfo}>
          <Text style={styles.infoLabel}>Item: </Text>
          <Text style={styles.infoValue}>{item.complaintId.itemType}</Text>
          <Text style={styles.infoLabel}> | Vehicle: </Text>
          <Text style={styles.infoValue}>{item.complaintId.vehicleNumber}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        {item.status !== "acknowledged" && (
          <TouchableOpacity
            style={styles.ackButton}
            onPress={() => acknowledgeAlert(item._id)}
          >
            <Text style={styles.ackText}>✓ Acknowledge</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const getChannelColor = (channel) => {
    const colors = {
      call: "#e74c3c",
      sms: "#3498db",
      push: "#9b59b6",
      app: "#27ae60",
    };
    return colors[channel] || "#95a5a6";
  };

  const getChannelIcon = (channel) => {
    const icons = { call: "📞", sms: "💬", push: "🔔", app: "📱" };
    return icons[channel] || "📩";
  };

  const getStatusColor = (status) => {
    const colors = {
      queued: "#f39c12",
      sent: "#3498db",
      delivered: "#9b59b6",
      acknowledged: "#27ae60",
      failed: "#e74c3c",
    };
    return colors[status] || "#95a5a6";
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incoming Alerts</Text>
      {alerts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>No alerts</Text>
          <Text style={styles.emptySubtext}>
            You'll be notified of lost items here
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e94560"
            />
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f23",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#e94560",
    padding: 20,
    paddingBottom: 10,
  },
  list: {
    padding: 15,
    paddingTop: 5,
  },
  card: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  channelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  channelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  time: {
    color: "#666",
    fontSize: 12,
  },
  message: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  complaintInfo: {
    flexDirection: "row",
    marginBottom: 12,
  },
  infoLabel: {
    color: "#666",
    fontSize: 12,
  },
  infoValue: {
    color: "#e94560",
    fontSize: 12,
    fontWeight: "600",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
  },
  ackButton: {
    backgroundColor: "#27ae60",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ackText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 15,
  },
  emptyText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  emptySubtext: {
    color: "#8b8b8b",
    fontSize: 14,
    marginTop: 5,
  },
});
