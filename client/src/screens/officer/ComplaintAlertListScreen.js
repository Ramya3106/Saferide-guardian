import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const ComplaintAlertListScreen = ({ alerts, selectedId, onSelect }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complaint Alert List</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {alerts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No active complaint alerts.</Text>
          </View>
        ) : (
          alerts.map((alert) => {
            const selected = selectedId === alert.id;
            return (
              <Pressable
                key={alert.id}
                style={[styles.item, selected && styles.itemActive]}
                onPress={() => onSelect(alert)}
              >
                <View style={styles.topRow}>
                  <Text style={styles.idText}>{alert.id}</Text>
                  <Text style={styles.status}>{alert.status}</Text>
                </View>
                <Text style={styles.itemType}>{alert.itemType}</Text>
                <Text style={styles.meta}>{alert.vehicleNumber} | {alert.route}</Text>
                <Text style={styles.meta}>Passenger: {alert.passengerName}</Text>
                <Text style={styles.meta}>Priority: {alert.priority}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  list: {
    gap: 8,
    paddingBottom: 8,
  },
  item: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 12,
  },
  itemActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  idText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  status: {
    fontSize: 12,
    color: "#1D4ED8",
    fontWeight: "700",
  },
  itemType: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "700",
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: "#475569",
  },
  emptyBox: {
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
  },
  emptyText: {
    color: "#475569",
  },
});

export default ComplaintAlertListScreen;
