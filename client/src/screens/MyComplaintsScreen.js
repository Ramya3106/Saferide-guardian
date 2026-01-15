import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

const STATUS_COLORS = {
  reported: "#f39c12",
  alerted: "#3498db",
  located: "#9b59b6",
  secured: "#27ae60",
  returned: "#2ecc71",
  closed: "#95a5a6",
};

const STATUS_ICONS = {
  reported: "📝",
  alerted: "🔔",
  located: "📍",
  secured: "🔒",
  returned: "✅",
  closed: "☑️",
};

export default function MyComplaintsScreen({ navigation }) {
  const [complaints, setComplaints] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchComplaints = useCallback(async () => {
    try {
      const response = await api.get("/complaints/my");
      setComplaints(response.data);
    } catch (error) {
      console.error("Failed to fetch complaints:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchComplaints();
    }, [fetchComplaints])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchComplaints();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("ComplaintDetail", { id: item._id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.itemType}>
          {item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1)}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[item.status] },
          ]}
        >
          <Text style={styles.statusText}>
            {STATUS_ICONS[item.status]} {item.status}
          </Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {item.itemDescription}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.meta}>
          🚃 {item.vehicleType} {item.vehicleNumber}
        </Text>
        <Text style={styles.meta}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <View
        style={[
          styles.priorityBar,
          { backgroundColor: getPriorityColor(item.priority) },
        ]}
      />
    </TouchableOpacity>
  );

  const getPriorityColor = (priority) => {
    const colors = {
      critical: "#e74c3c",
      high: "#e67e22",
      medium: "#f1c40f",
      low: "#3498db",
    };
    return colors[priority] || "#95a5a6";
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Lost Items</Text>
      {complaints.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No complaints yet</Text>
          <Text style={styles.emptySubtext}>
            Report a lost item to get started
          </Text>
        </View>
      ) : (
        <FlatList
          data={complaints}
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
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemType: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  description: {
    color: "#8b8b8b",
    fontSize: 14,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: {
    color: "#666",
    fontSize: 12,
  },
  priorityBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
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
